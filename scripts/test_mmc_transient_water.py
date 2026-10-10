"""Synthetic tests: transient water flags are screening signals, not flood labels."""
import unittest
from mmc_transient_water_screen import screen

def item(plot,prev,now,change,area=100,status="AUTO_VALID"):
    return {"plot":plot,"date_a":prev,"date_b":now,
            "water_net_change_rai":change,"common_clear_rai":area,
            "status":status}

class TestTransientWater(unittest.TestCase):
    def test_consecutive_reversal(self):
        data=[item("16-STC","2026-07-19","2026-09-29",22.528,25.321),
              item("16-STC","2026-09-29","2026-10-07",-10.163,24.954),
              item("92-STC","2026-09-29","2026-10-02",1.256,95.288),
              item("92-STC","2026-10-02","2026-10-07",-1.547,95.288)]
        result=screen(data)
        self.assertEqual({x["plot"] for x in result},{"16-STC","92-STC"})
        self.assertTrue(all(x["status"]=="TRANSIENT_WATER_SIGNAL_REVIEW" for x in result))
    def test_reject_unrelated_or_unreviewable(self):
        self.assertEqual(screen([item("p","2026-01-01","2026-01-02",3),
             item("p","2026-01-02","2026-01-03",2)]),[])
        self.assertEqual(screen([item("p","2026-01-01","2026-01-02",3),
             item("p","2026-01-02","2026-02-12",-2)]),[])
        self.assertEqual(screen([item("p","2026-01-01","2026-01-02",3,status="PARTIAL"),
             item("p","2026-01-02","2026-01-03",-3)]),[])

if __name__=="__main__":unittest.main()
