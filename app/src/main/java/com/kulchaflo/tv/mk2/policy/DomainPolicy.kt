package com.kulchaflo.tv.mk2.policy

class DomainPolicy {
    fun shouldStayInApp(url: String): Boolean = true

    fun shouldAllowPopup(url: String): Boolean = true
}
