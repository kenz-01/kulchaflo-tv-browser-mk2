package com.kulchaflo.tv.mk2.promotedmedia

sealed interface NormalizedMediaSelection {
    data class Playable(
        val sourceId: String,
        val uri: String,
        val mimeType: String?,
        val selectedKind: String,
        val headers: Map<String, String> = emptyMap(),
    ) : NormalizedMediaSelection

    data class PlayerLimited(
        val kind: String,
        val detail: String,
    ) : NormalizedMediaSelection

    data class NoPlayableSource(
        val detail: String,
    ) : NormalizedMediaSelection
}

fun NormalizedMediaSelection.toSourceResult(): PromotedMediaSiteAdapter.SourceResult {
    return when (this) {
        is NormalizedMediaSelection.Playable -> PromotedMediaSiteAdapter.SourceResult(
            source = PromotedMediaSource(
                sourceId = sourceId,
                kind = PromotedMediaSource.Kind.EXTRACTED_STREAM,
                uri = uri,
                mimeType = mimeType,
                headers = headers,
            ),
            reason = selectedKind,
        )

        is NormalizedMediaSelection.PlayerLimited -> PromotedMediaSiteAdapter.SourceResult(
            source = null,
            reason = "player-limited kind=$kind detail=$detail",
        )

        is NormalizedMediaSelection.NoPlayableSource -> PromotedMediaSiteAdapter.SourceResult(
            source = null,
            reason = "no-playable-source detail=$detail",
        )
    }
}
