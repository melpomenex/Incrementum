moddef::moddef!(flat(pub) mod {
    lsx,
    lasx
});

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

macro_rules! with_ty {
    ($func: ident, i8) => {
        paste!([<$func _b>])
    };
    ($func: ident, u8) => {
        paste!([<$func _bu>])
    };
        ($func: ident, i16) => {
        paste!([<$func _h>])
    };
    ($func: ident, u16) => {
        paste!([<$func _hu>])
    };
    ($func: ident, i32) => {
        paste!([<$func _w>])
    };
    ($func: ident, u32) => {
        paste!([<$func _wu>])
    };
    ($func: ident, i64) => {
        paste!([<$func _d>])
    };
    ($func: ident, u64) => {
        paste!([<$func _du>])
    };
    ($func: ident, f32) => {
        paste!([<$func _s>])
    };
    ($func: ident, f64) => {
        paste!([<$func _d>])
    };
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

macro_rules! impl_cmp {
    ($func: ident, $intrinsic: ident, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register, b: Self::Register) -> <$ty as Scalar>::Mask<Self> {
                cast!(with_ty!($intrinsic, $ty)(cast!(a), cast!(b)))
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                true
            }
        })*
    };
}
pub(crate) use impl_cmp;

macro_rules! impl_cmp_signless {
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
pub(crate) use impl_cmp_signless;
