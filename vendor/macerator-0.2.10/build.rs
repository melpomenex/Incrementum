use std::env;

use cfg_aliases::cfg_aliases;

fn main() {
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap();
    println!("cargo::rustc-check-cfg=cfg(avx512)");
    println!("cargo::rustc-check-cfg=cfg(avx512_nightly)");

    if target_arch == "x86_64" {
        let version = rustc_version::version().unwrap();
        let avx512_feature_enabled = env::var("CARGO_FEATURE_AVX512").is_ok();
        let nightly_feature_enabled = env::var("CARGO_FEATURE_NIGHTLY").is_ok();

        let avx512_stable_version = rustc_version::Version::new(1, 89, 0);

        if (version >= avx512_stable_version && avx512_feature_enabled) || nightly_feature_enabled {
            println!("cargo:rustc-cfg=avx512");
        }
        if version < avx512_stable_version && nightly_feature_enabled {
            println!("cargo:rustc-cfg=avx512_nightly")
        }
    }

    cfg_aliases! {
        x86: { any(target_arch = "x86", target_arch = "x86_64") },
        fp16: { all(target_arch = "x86_64", feature = "fp16", feature = "nightly") },
        aarch64: { target_arch = "aarch64" },
        wasm32: { target_arch = "wasm32" },
        loong64: { all(target_arch = "loongarch64", feature = "nightly") }
    }
}
