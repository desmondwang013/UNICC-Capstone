"""
Petri Utils Package

This package contains utility modules for the Petri AI safety testing framework.

Note: There's a naming conflict - petri/utils.py exists as a module
and petri/utils/ exists as a package. This __init__.py re-exports content
from both to maintain backward compatibility.
"""

# Import from the parent-level utils.py module (for backward compatibility)
# We need to import it before the package shadows it
import sys
import os

# Get the parent directory (petri/)
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Import the utils.py module directly
import importlib.util
utils_py_path = os.path.join(parent_dir, 'utils.py')
spec = importlib.util.spec_from_file_location("_petri_utils_module", utils_py_path)
_utils_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(_utils_module)

# Re-export from utils.py (only what exists)
SampleMetadata = _utils_module.SampleMetadata
load_transcripts_from_directory = _utils_module.load_transcripts_from_directory
load_transcripts_from_paths = _utils_module.load_transcripts_from_paths
extract_xml_tags = _utils_module.extract_xml_tags
extract_xml_tag = _utils_module.extract_xml_tag
reformat_antml_tags = _utils_module.reformat_antml_tags

# Import from new utils subpackage modules
from petri.utils.data_validator import DataValidator, DataSample, DataManifest
from petri.utils.termination import TerminationManager, TerminationDecision
from petri.utils.reproducibility import (
    ReproducibilityManager,
    DecisionRecord,
    ReproducibilityConfig,
    WeightCalibrator,
)

__all__ = [
    # From utils.py (backward compatibility)
    "SampleMetadata",
    "load_transcripts_from_directory",
    "load_transcripts_from_paths",
    "extract_xml_tags",
    "extract_xml_tag",
    "reformat_antml_tags",
    # Data Validation
    "DataValidator",
    "DataSample",
    "DataManifest",
    # Termination
    "TerminationManager",
    "TerminationDecision",
    # Reproducibility
    "ReproducibilityManager",
    "DecisionRecord",
    "ReproducibilityConfig",
    "WeightCalibrator",
]

