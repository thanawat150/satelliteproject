"""Screen repeated water reversals across successive QA-valid change comparisons.

A reversal is a *review candidate*, never a verified flood or tidal correction.
"""
from collections import defaultdict
from datetime import date

def screen(changes,days=14,min_rai=0.25,min_fraction=0.01):
    by_plot=defaultdict(list)
    for row in changes:
        if row.get("status")=="AUTO_VALID":
            by_plot[row["plot"]].append(row)
    flagged=[]
    for plot,rows in by_plot.items():
        rows.sort(key=lambda x:x["date_b"])
        for previous,current in zip(rows,rows[1:]):
            a=float(previous.get("water_net_change_rai") or 0)
            b=float(current.get("water_net_change_rai") or 0)
            period=(date.fromisoformat(current["date_b"])-date.fromisoformat(previous["date_b"])).days
            if a*b>=0 or period<0 or period>days:
                continue
            area_a=float(previous.get("common_clear_rai") or 0)
            area_b=float(current.get("common_clear_rai") or 0)
            if not area_a or not area_b:
                continue
            if min(abs(a),abs(b))<min_rai:
                continue
            if min(abs(a)/area_a,abs(b)/area_b)<min_fraction:
                continue
            flagged.append({"plot":plot,"first_after":previous["date_b"],
                "second_after":current["date_b"],"first_water_change_rai":a,
                "second_water_change_rai":b,"interval_days":period,
                "status":"TRANSIENT_WATER_SIGNAL_REVIEW",
                "notes":"Check tides, cloud mask, acquisition time and field context; not a flood confirmation."})
    return flagged
