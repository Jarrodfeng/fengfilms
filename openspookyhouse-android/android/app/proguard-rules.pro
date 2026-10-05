# Methods called from JavaScript
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
# Referenced by name from AndroidManifest.xml meta-data
-keep class com.openspookyhouse.android.CastOptionsProvider { *; }
