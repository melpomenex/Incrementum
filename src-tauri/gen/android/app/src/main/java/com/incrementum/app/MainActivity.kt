package com.incrementum.app

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Enable edge-to-edge display - this configures the window to:
        // 1. Draw content behind system bars (status bar, navigation bar)
        // 2. Set transparent colors for system bars
        // 3. Report safe area insets to the WebView via CSS env(safe-area-inset-*)
        // Note: Must be called before super.onCreate()
        enableEdgeToEdge()

        super.onCreate(savedInstanceState)
    }
}
