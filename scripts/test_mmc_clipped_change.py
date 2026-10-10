#!/usr/bin/env python3
"""Regression tests for geometry-clipped pixel change; synthetic inputs only."""
import importlib.util
from pathlib import Path
import unittest
import numpy as np
from rasterio import Affine
from shapely.geometry import box

spec=importlib.util.spec_from_file_location("nationwide_process",Path(__file__).with_name("nationwide_process.py"))
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def sample(valid,water,vegetation,soil,polygon,day):
    arrays={k:np.asarray(v,dtype=np.uint8) for k,v in {
        "valid":valid,"water":water,"vegetation":vegetation,"bare_soil":soil}.items()}
    return {"row":{"date":day,"qa_valid_pct":100},
            "grid":{"crs":"EPSG:32647","transform":tuple(Affine(20,0,0,0,-20,40))[:6],
                    "height":2,"width":2},
            "boundary_projected":polygon,"arrays":arrays}

class TestGeometryClippedChange(unittest.TestCase):
    def test_half_cell_is_not_full_cell_area(self):
        # Polygon intersects half of each pixel in its left column: 200m2 total.
        boundary=box(0,0,10,40)
        a=sample([[1,0],[1,0]],[[0,0],[0,0]],[[1,0],[1,0]],[[0,0],[0,0]],boundary,"2026-01-01")
        b=sample([[1,0],[1,0]],[[1,0],[1,0]],[[0,0],[0,0]],[[0,0],[0,0]],boundary,"2026-02-01")
        change=mod.change_summary(a,b)
        self.assertEqual(change["common_clear_pixels"],2)
        self.assertAlmostEqual(change["common_clear_rai"],0.125,places=3)
        self.assertAlmostEqual(change["water_new_rai"],0.125,places=3)
        self.assertAlmostEqual(change["vegetation_lost_rai"],0.125,places=3)
        self.assertEqual(change["interpretation"],"SCREENING_ONLY_NO_TIDAL_OR_FIELD_VALIDATION")
        self.assertFalse(change["tide_normalized"])

    def test_noncomparable_masks_are_excluded(self):
        boundary=box(0,0,40,40)
        a=sample([[1,0],[0,0]],[[1,0],[0,0]],[[0,0],[0,0]],[[0,0],[0,0]],boundary,"2026-01-01")
        b=sample([[0,0],[0,1]],[[0,0],[0,1]],[[0,0],[0,0]],[[0,0],[0,0]],boundary,"2026-02-01")
        change=mod.change_summary(a,b)
        self.assertEqual(change["status"],"NO_COMPARABLE_CLEAR_PIXELS")
        self.assertEqual(change["common_clear_pixels"],0)
        self.assertEqual(change["common_clear_rai"],0)

    def test_small_overlap_has_review_flag(self):
        boundary=box(0,0,40,40)
        a=sample([[1,0],[0,0]],[[0,0],[0,0]],[[1,0],[0,0]],[[0,0],[0,0]],boundary,"2026-01-01")
        b=sample([[1,0],[0,0]],[[1,0],[0,0]],[[0,0],[0,0]],[[0,0],[0,0]],boundary,"2026-02-01")
        change=mod.change_summary(a,b)
        self.assertEqual(change["comparison_review"],"SMALL_OVERLAP_REVIEW")
        self.assertEqual(change["common_clear_pct_of_plot"],25.0)

if __name__=="__main__":
    unittest.main()
