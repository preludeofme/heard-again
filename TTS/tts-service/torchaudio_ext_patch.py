"""
Patched torchaudio/_extension/__init__.py for NGC torch compatibility.

PyPI libtorchaudio.so is compiled against CUDA 12.x and is ABI-incompatible
with NGC 25.12's CUDA 13.1 torch. This patch makes the C extension load
non-fatal so torchaudio's Python API (compliance.kaldi, etc.) still works.
"""
import logging
import os
import sys

import torch

from torchaudio._internal.module_utils import fail_with_message, no_op

from .utils import _check_cuda_version, _init_dll_path, _load_lib

_LG = logging.getLogger(__name__)

__all__ = [
    "_check_cuda_version",
    "_IS_TORCHAUDIO_EXT_AVAILABLE",
]

if os.name == "nt" and (3, 8) <= sys.version_info < (3, 9):
    _init_dll_path()

_IS_TORCHAUDIO_EXT_AVAILABLE = _load_lib("_torchaudio")
_IS_ALIGN_AVAILABLE = False

if _IS_TORCHAUDIO_EXT_AVAILABLE:
    try:
        if not _load_lib("libtorchaudio"):
            raise ImportError("Failed to load libtorchaudio")
        _check_cuda_version()
        _IS_ALIGN_AVAILABLE = torch.ops._torchaudio.is_align_available()
    except (OSError, ImportError) as _e:
        import warnings
        warnings.warn(
            f"torchaudio C extension could not be loaded ({_e}). "
            "This is expected when using NGC torch. "
            "Python-based features (torchaudio.compliance.kaldi etc.) still work."
        )
        _IS_TORCHAUDIO_EXT_AVAILABLE = False

fail_if_no_align = (
    no_op
    if _IS_ALIGN_AVAILABLE
    else fail_with_message(
        "Requires alignment extension, but TorchAudio is not compiled with it. "
        "Please build TorchAudio with alignment support."
    )
)
