moddef::moddef!(
    flat(pub) mod {
        x86 for cfg(x86),
        aarch64 for cfg(aarch64),
        loong64 for cfg(loong64),
        wasm32 for cfg(wasm32),
        scalar for cfg(not(any(x86, aarch64, loong64, wasm32)))
    }
);

#[cfg(all(feature = "std", x86))]
#[macro_export]
macro_rules! feature_detected {
    ($feature: tt) => {
        ::std::is_x86_feature_detected!($feature)
    };
}

#[cfg(all(feature = "std", aarch64))]
#[macro_export]
macro_rules! feature_detected {
    ($feature: tt) => {
        ::std::arch::is_aarch64_feature_detected!($feature)
    };
}

#[cfg(all(feature = "std", loong64))]
#[macro_export]
macro_rules! feature_detected {
    ($feature: tt) => {
        ::std::arch::is_loongarch_feature_detected!($feature)
    };
}

#[cfg(any(not(feature = "std"), not(any(x86, aarch64, loong64))))]
#[macro_export]
macro_rules! feature_detected {
    ($feature: tt) => {
        cfg!(target_feature = $feature)
    };
}

#[allow(unused)]
pub(crate) use feature_detected;

#[cfg(any(x86, aarch64, loong64, wasm32))]
macro_rules! impl_simd {
    ($($feature: tt),*) => {
        #[inline(always)]
        pub(crate) fn __static_available() -> &'static ::core::sync::atomic::AtomicU8 {
            static AVAILABLE: ::core::sync::atomic::AtomicU8 =
                ::core::sync::atomic::AtomicU8::new(u8::MAX);
            &AVAILABLE
        }

        /// Returns `true` if the required CPU features for this type are available,
        /// otherwise returns `false`.
        #[inline]
        pub fn is_available() -> bool {
            let mut available =
                Self::__static_available().load(::core::sync::atomic::Ordering::Relaxed);
            if available == u8::MAX {
                available = Self::__detect_is_available() as u8;
            }
            available != 0
        }

        #[inline(never)]
        fn __detect_is_available() -> bool {
            let out = true $(&& $crate::backend::arch::feature_detected!($feature))*;
            Self::__static_available().store(out as u8, ::core::sync::atomic::Ordering::Relaxed);
            out
        }

        /// Vectorizes the given function as if the CPU features for this type were
    /// applied to it.
    ///
    /// # Note
    /// For the vectorization to work properly, the given function must be
    /// inlined. Consider marking it as `#[inline(always)]`
    #[inline(always)]
    pub fn run_vectorized<F: NullaryFnOnce>(f: F) -> F::Output {
        $(#[target_feature(enable = $feature)])*
        #[inline]
        #[allow(clippy::too_many_arguments)]
        unsafe fn imp_fastcall<F: NullaryFnOnce>(
            f0: ::core::mem::MaybeUninit<::core::primitive::usize>,
            f1: ::core::mem::MaybeUninit<::core::primitive::usize>,
            f2: ::core::mem::MaybeUninit<::core::primitive::usize>,
            f3: ::core::mem::MaybeUninit<::core::primitive::usize>,
            f4: ::core::mem::MaybeUninit<::core::primitive::usize>,
            f5: ::core::mem::MaybeUninit<::core::primitive::usize>,
            f6: ::core::mem::MaybeUninit<::core::primitive::usize>,
            f7: ::core::mem::MaybeUninit<::core::primitive::usize>,
        ) -> F::Output {
            let f: F = unsafe { core::mem::transmute_copy(&[f0, f1, f2, f3, f4, f5, f6, f7]) };
            f.call()
        }
        $(#[target_feature(enable = $feature)])*
        #[inline]
        unsafe fn imp<F: NullaryFnOnce>(f: F) -> F::Output {
            f.call()
        }
        if const {
            (::core::mem::size_of::<F>() <= 8 * ::core::mem::size_of::<::core::primitive::usize>())
        } {
            union Pad<T> {
                t: ::core::mem::ManuallyDrop<T>,
                __u: ::core::mem::MaybeUninit<[usize; 8]>,
            }
            let f = Pad {
                t: ::core::mem::ManuallyDrop::new(f),
            };
            let p = (&f) as *const _ as *const ::core::mem::MaybeUninit<usize>;
            unsafe {
                imp_fastcall::<F>(
                    *p.add(0),
                    *p.add(1),
                    *p.add(2),
                    *p.add(3),
                    *p.add(4),
                    *p.add(5),
                    *p.add(6),
                    *p.add(7),
                )
            }
        } else {
            unsafe { imp(f) }
        }
    }
    };
}

#[cfg(any(x86, aarch64, loong64, wasm32))]
pub(crate) use impl_simd;

use super::Simd;

pub trait NullaryFnOnce {
    type Output;

    fn call(self) -> Self::Output;
}

impl<R, F: FnOnce() -> R> NullaryFnOnce for F {
    type Output = R;

    #[inline(always)]
    fn call(self) -> Self::Output {
        self()
    }
}

pub trait WithSimd {
    type Output;

    fn with_simd<S: Simd>(self) -> Self::Output;
}

impl<F: NullaryFnOnce> WithSimd for F {
    type Output = F::Output;

    #[inline(always)]
    fn with_simd<S: Simd>(self) -> Self::Output {
        self.call()
    }
}
