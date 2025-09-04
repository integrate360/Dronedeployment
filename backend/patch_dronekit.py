# patch_dronekit.py
import collections
import collections.abc

# Monkey patch collections to include MutableMapping for backward compatibility
if not hasattr(collections, 'MutableMapping'):
    collections.MutableMapping = collections.abc.MutableMapping

if not hasattr(collections, 'Mapping'):
    collections.Mapping = collections.abc.Mapping

if not hasattr(collections, 'Sequence'):
    collections.Sequence = collections.abc.Sequence

if not hasattr(collections, 'Iterable'):
    collections.Iterable = collections.abc.Iterable