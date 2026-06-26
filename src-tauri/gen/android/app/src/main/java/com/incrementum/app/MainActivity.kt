package com.incrementum.app

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import app.tauri.plugin.PluginManager

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Enable edge-to-edge display - this configures the window to:
        // 1. Draw content behind system bars (status bar, navigation bar)
        // 2. Set transparent colors for system bars
        // 3. Report safe area insets to the WebView via CSS env(safe-area-inset-*)
        // Note: Must be called before super.onCreate()
        enableEdgeToEdge()

        // Register the activity-result launchers that plugins (e.g. folder-import's
        // SAF folder picker) use via Plugin.startActivityForResult(). The generated
        // TauriActivity wires every other PluginManager lifecycle hook (onResume,
        // onPause, …) but omits onActivityCreate, so the launchers stay lateinit
        // and any plugin call to startActivityForResult() crashes with
        // "lateinit property startActivityForResultLauncher has not been initialized".
        // Must run before super.onCreate() so the launchers exist before plugins
        // can fire (super.onCreate triggers the Wry/Rust webview init).
        PluginManager.onActivityCreate(this)

        super.onCreate(savedInstanceState)
    }
}
