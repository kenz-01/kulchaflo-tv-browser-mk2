package com.kulchaflo.tv.mk2.gv.media

import java.net.URI
import java.security.MessageDigest
import java.util.Locale

/**
 * In-memory lifecycle state for a native direct-media promotion.
 *
 * The tracker deliberately retains only hashes of document identities and media sources. A
 * dismissal belongs to one session/document generation and survives repeated evidence from that
 * document. A genuine top-level navigation creates a new generation and clears the dismissal.
 */
class GvDirectMediaDismissalTracker<SessionKey : Any> {
    enum class DecisionState(val diagnosticName: String) {
        ALLOW_PROMOTION("allow-promotion"),
        SUPPRESS_USER_DISMISSED_DOCUMENT("suppress-user-dismissed-document"),
    }

    data class PromotionDecision(
        val state: DecisionState,
        val reasonCodes: List<String>,
        val documentGeneration: Long?,
    )

    data class DocumentUpdate(
        val documentGeneration: Long,
        val documentChanged: Boolean,
    )

    data class DismissalRecord(
        val documentGeneration: Long,
        val normalizedPageIdentitySha256: String,
        val promotedSourceSha256: String,
        val reason: String,
    )

    private data class DocumentState(
        val normalizedPageIdentitySha256: String,
        val generation: Long,
    )

    private data class ActivePromotion<SessionKey>(
        val session: SessionKey,
        val generation: Long,
        val normalizedPageIdentitySha256: String,
        val promotedSourceSha256: String,
    )

    private val documents = LinkedHashMap<SessionKey, DocumentState>()
    private val dismissals = LinkedHashMap<SessionKey, DismissalRecord>()
    private var activePromotion: ActivePromotion<SessionKey>? = null

    fun onLocationChanged(session: SessionKey, pageLocation: String): DocumentUpdate {
        val identitySha256 = normalizedDocumentIdentitySha256(pageLocation)
        val previous = documents[session]
        return replaceDocument(
            session = session,
            identitySha256 = identitySha256,
            nextGeneration = (previous?.generation ?: 0L) + 1L,
        )
    }

    fun ensureDocument(session: SessionKey, pageLocation: String): DocumentUpdate {
        val identitySha256 = normalizedDocumentIdentitySha256(pageLocation)
        val previous = documents[session]
        if (previous?.normalizedPageIdentitySha256 == identitySha256) {
            return DocumentUpdate(
                documentGeneration = previous.generation,
                documentChanged = false,
            )
        }

        return replaceDocument(
            session = session,
            identitySha256 = identitySha256,
            nextGeneration = (previous?.generation ?: 0L) + 1L,
        )
    }

    private fun replaceDocument(
        session: SessionKey,
        identitySha256: String,
        nextGeneration: Long,
    ): DocumentUpdate {
        documents[session] = DocumentState(
            normalizedPageIdentitySha256 = identitySha256,
            generation = nextGeneration,
        )
        dismissals.remove(session)
        if (activePromotion?.session == session) {
            activePromotion = null
        }
        return DocumentUpdate(
            documentGeneration = nextGeneration,
            documentChanged = true,
        )
    }

    fun recordPromotion(session: SessionKey, promotedSource: String): Boolean {
        val document = documents[session] ?: return false
        if (promotionDecision(session).state != DecisionState.ALLOW_PROMOTION) {
            return false
        }
        activePromotion = ActivePromotion(
            session = session,
            generation = document.generation,
            normalizedPageIdentitySha256 = document.normalizedPageIdentitySha256,
            promotedSourceSha256 = sha256(promotedSource),
        )
        return true
    }

    fun dismissActivePromotion(
        session: SessionKey,
        reason: String = USER_BACK_REASON,
    ): DismissalRecord? {
        require(reason == USER_BACK_REASON) { "Unsupported direct-media dismissal reason." }
        val active = activePromotion
        if (active == null || active.session != session) {
            return null
        }
        val document = documents[session]
        if (
            document == null ||
            document.generation != active.generation ||
            document.normalizedPageIdentitySha256 != active.normalizedPageIdentitySha256
        ) {
            activePromotion = null
            return null
        }

        val record = DismissalRecord(
            documentGeneration = active.generation,
            normalizedPageIdentitySha256 = active.normalizedPageIdentitySha256,
            promotedSourceSha256 = active.promotedSourceSha256,
            reason = reason,
        )
        dismissals[session] = record
        activePromotion = null
        return record
    }

    fun promotionDecision(session: SessionKey): PromotionDecision {
        val document = documents[session]
        val dismissal = dismissals[session]
        if (
            document != null &&
            dismissal != null &&
            dismissal.documentGeneration == document.generation &&
            dismissal.normalizedPageIdentitySha256 == document.normalizedPageIdentitySha256
        ) {
            return PromotionDecision(
                state = DecisionState.SUPPRESS_USER_DISMISSED_DOCUMENT,
                reasonCodes = listOf(
                    "retain-browser-after-user-back",
                    "ignore-stale-promotion-evidence",
                ),
                documentGeneration = document.generation,
            )
        }
        return PromotionDecision(
            state = DecisionState.ALLOW_PROMOTION,
            reasonCodes = emptyList(),
            documentGeneration = document?.generation,
        )
    }

    fun closeSession(session: SessionKey) {
        documents.remove(session)
        dismissals.remove(session)
        if (activePromotion?.session == session) {
            activePromotion = null
        }
    }

    fun hasActivePromotion(session: SessionKey): Boolean =
        activePromotion?.session == session

    companion object {
        const val USER_BACK_REASON = "user-back"

        private fun normalizedDocumentIdentitySha256(pageLocation: String): String {
            val normalized = try {
                val uri = URI(pageLocation.trim())
                val scheme = uri.scheme?.lowercase(Locale.ROOT)
                val host = uri.host?.lowercase(Locale.ROOT)
                if ((scheme != "http" && scheme != "https") || host.isNullOrBlank()) {
                    "opaque-document"
                } else {
                    val port = when {
                        uri.port < 0 -> ""
                        scheme == "http" && uri.port == 80 -> ""
                        scheme == "https" && uri.port == 443 -> ""
                        else -> ":${uri.port}"
                    }
                    val path = uri.rawPath?.ifBlank { "/" } ?: "/"
                    val query = uri.rawQuery?.let { "?$it" }.orEmpty()
                    "$scheme://$host$port$path$query"
                }
            } catch (_: Exception) {
                "opaque-document"
            }
            return sha256(normalized)
        }

        private fun sha256(value: String): String =
            MessageDigest.getInstance("SHA-256")
                .digest(value.toByteArray(Charsets.UTF_8))
                .joinToString("") { byte -> "%02x".format(byte) }
    }
}
