#![allow(
    clippy::missing_transmute_annotations,
    clippy::useless_transmute,
    clippy::transmute_int_to_float,
    unused_unsafe
)]
// Lint can't detect the build script version check
#![cfg_attr(all(avx512, not(avx512_nightly)), allow(incompatible_msrv))]

pub mod v2;
pub mod v3;
#[cfg(avx512)]
pub mod v4;

pub use v2::V2;
pub use v3::V3;
#[cfg(avx512)]
pub use v4::V4;
#[cfg(fp16)]
pub use v4::V4FP16;

macro_rules! lanes {
    ($($bits: literal),*) => {
        $(paste! {
            #[inline(always)]
            fn [<lanes $bits>]() -> usize {
                WIDTH / $bits
            }
        })*
    };
}
pub(crate) use lanes;

macro_rules! impl_binop_scalar {
    ($func: ident, $intrinsic: path, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register, b: Self::Register) -> Self::Register {
                const LANES: usize = WIDTH / (8 * size_of::<$ty>());
                let a: [$ty; LANES] = cast!(a);
                let b: [$ty; LANES] = cast!(b);
                let mut out = [$ty::default(); LANES];

                for i in 0..LANES {
                    out[i] = $intrinsic(a[i], b[i]);
                }
                cast!(out)
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                false
            }
        })*
    };
}
pub(crate) use impl_binop_scalar;

macro_rules! impl_unop_scalar {
    ($func: ident, $intrinsic: path, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register) -> Self::Register {
                const LANES: usize = WIDTH / (8 * size_of::<$ty>());
                let a: [$ty; LANES] = cast!(a);
                let mut out = [$ty::default(); LANES];

                for i in 0..LANES {
                    out[i] = a[i].$intrinsic();
                }
                cast!(out)
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                false
            }
        })*
    };
}
pub(crate) use impl_unop_scalar;

macro_rules! impl_reduce_scalar {
    ($func: ident, $intrinsic: path, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register) -> $ty {
                const LANES: usize = WIDTH / (8 * size_of::<$ty>());
                let a: [$ty; LANES] = cast!(a);
                let mut out: $ty = a[0];

                for i in 1..LANES {
                    out = out.$intrinsic(a[i]);
                }
                out
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                false
            }
        })*
    };
}
pub(crate) use impl_reduce_scalar;

macro_rules! with_ty {
    ($func: ident, f16) => {
        paste!([<$func _ph>])
    };
    ($func: ident, f32) => {
        paste!([<$func _ps>])
    };
    ($func: ident, f64) => {
        paste!([<$func _pd>])
    };
    ($func: ident, $ty: ident) => {
        paste!([<$func _ep $ty>])
    }
}
pub(crate) use with_ty;

macro_rules! with_ty_signless {
    ($func: ident, u8) => {
        with_ty!($func, i8)
    };
    ($func: ident, u16) => {
        with_ty!($func, i16)
    };
    ($func: ident, u32) => {
        with_ty!($func, i32)
    };
    ($func: ident, u64) => {
        with_ty!($func, i64)
    };
    ($func: ident, $ty: ident) => {
        with_ty!($func, $ty)
    };
}
pub(crate) use with_ty_signless;

macro_rules! impl_binop_signless {
    ($func: ident, $intrinsic: ident, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register, b: Self::Register) -> Self::Register {
                cast!(with_ty_signless!($intrinsic, $ty)(cast!(a), cast!(b)))
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                true
            }
        })*
    };
}
pub(crate) use impl_binop_signless;

macro_rules! impl_binop {
    ($func: ident, $intrinsic: ident, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register, b: Self::Register) -> Self::Register {
                cast!(with_ty!($intrinsic, $ty)(cast!(a), cast!(b)))
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                true
            }
        })*
    };
}
pub(crate) use impl_binop;

macro_rules! impl_binop_untyped {
    ($func: ident, $intrinsic: ident) => {
        paste! {
            #[inline(always)]
            fn $func(a: Self::Register, b: Self::Register) -> Self::Register {
                cast!($intrinsic(cast!(a), cast!(b)))
            }
            #[inline(always)]
            fn [<$func _supported>]() -> bool {
                true
            }
        }
    };
}
pub(crate) use impl_binop_untyped;

macro_rules! impl_unop {
    ($func: ident, $intrinsic: ident, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register) -> Self::Register {
                cast!(with_ty!($intrinsic, $ty)(cast!(a)))
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                true
            }
        })*
    };
}
pub(crate) use impl_unop;

macro_rules! impl_reduce {
    ($func: ident, $intrinsic: ident, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register) -> $ty {
                unsafe { cast!(with_ty!($intrinsic, $ty)(cast!(a))) }
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                true
            }
        })*
    };
}
pub(crate) use impl_reduce;

macro_rules! impl_reduce_signless {
    ($func: ident, $intrinsic: ident, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register) -> $ty {
                cast!(with_ty_signless!($intrinsic, $ty)(cast!(a)))
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                true
            }
        })*
    };
}
pub(crate) use impl_reduce_signless;

macro_rules! impl_cmp {
    ($func: ident, $intrinsic: ident, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register, b: Self::Register) -> <$ty as Scalar>::Mask<Self> {
                cast!(with_ty_signless!($intrinsic, $ty)(cast!(a), cast!(b)))
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                true
            }
        })*
    };
}
pub(crate) use impl_cmp;
