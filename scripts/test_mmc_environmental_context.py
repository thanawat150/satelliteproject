"""Test missing-data discipline and UTC daily rainfall date windows without network."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from mmc_environmental_context import summarize,safe_rain,power_url,coordinate_map

class RainContextTests(unittest.TestCase):
    def test_utc_window_excludes_satellite_date(self):
        values={"20261006":10.0,"20261007":0.0,"20261008":4.2,"20261009":100.0}
        result=summarize("2026-10-09",values)
        self.assertEqual(result["rain_prev_1_utc_day_mm"],4.2)
        self.assertEqual(result["rain_prev_3_utc_days_mm"],14.2)
        self.assertEqual(result["data_quality"],"COMPLETE")
        self.assertIsNone(result["observation_time_utc"])
        self.assertIn("NOT_ACQUISITION_RELATIVE",result["time_alignment"])

    def test_missing_or_invalid_is_not_zero(self):
        values={"20261008":0.0,"20261007":-999,"20261006":3.0}
        result=summarize("2026-10-09",values)
        self.assertEqual(result["rain_prev_1_utc_day_mm"],0)
        self.assertIsNone(result["rain_prev_3_utc_days_mm"])
        self.assertEqual(result["data_quality"],"MISSING_DAILY_VALUES")
        self.assertIsNone(safe_rain(-999))
        self.assertIsNone(safe_rain(None))
        self.assertIsNone(safe_rain(float("nan")))

    def test_true_coordinates_and_provider(self):
        geo={"type":"FeatureCollection","features":[{"type":"Feature",
          "properties":{"plot":"a"},"geometry":{"type":"Polygon",
            "coordinates":[[[101,12],[101.001,12],[101.001,12.001],[101,12.001],[101,12]]]}}]}
        p=coordinate_map(geo)
        self.assertTrue(101<p["a"][1]<101.001)
        self.assertTrue(12<p["a"][0]<12.001)
        url=power_url(12.3,101.2,"20261001","20261008")
        self.assertIn("PRECTOTCORR",url)
        self.assertIn("time-standard=UTC",url)
        self.assertNotIn("IMERG",url)

if __name__=="__main__":
    unittest.main()
