#!/usr/bin/env python3
"""Assert completeness across BOTH legacy archive previews and generated TIFF rasters.

Scientific scene-QA and visual availability are separate questions.
This audit fails if any distinct plot/date lacks one of eight actual images.
"""
import json
import sys
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
HOME=ROOT/"docs"/"mangrove-monitoring"
MODES={"true_color","false_color","ndvi","ndre","ndmi","mndwi","bsi","ndwi"}

def main():
    m=json.loads((HOME/"imagery_manifest.json").read_text(encoding="utf-8"))
    old={(x["plot"],x["date"]):x for x in m.get("items",[])}
    gen={(x["plot"],x["date"]):x for x in m.get("generated_items",[])}
    failures=[]
    for key in sorted(set(old)|set(gen)):
        item=gen.get(key)
        if item:
            declared=set(item.get("modes",[]))
            paths=item.get("assets",{})
            for mode in sorted(MODES):
                if mode not in declared or mode not in paths:
                    failures.append([*key,mode,"MISSING_FROM_GENERATED_MANIFEST"])
                    continue
                src=str(paths[mode])
                if not src.startswith("./imagery/") or ".." in Path(src).parts:
                    failures.append([*key,mode,"UNSAFE_IMAGE_PATH"])
                    continue
                path=HOME/src.removeprefix("./")
                if not path.is_file() or path.stat().st_size<=40:
                    failures.append([*key,mode,"MISSING_OR_EMPTY_IMAGE_FILE"])
                    continue
                try:
                    with Image.open(path) as im:
                        if im.width<2 or im.height<2:
                            failures.append([*key,mode,"INVALID_IMAGE_DIMENSIONS"])
                        im.verify()
                except Exception as exc:
                    failures.append([*key,mode,"CORRUPT_FILE:"+str(exc)[:90]])
        else:
            legacy=old[key]
            modes=set(legacy.get("modes",[]))
            for mode in sorted(MODES-modes):
                failures.append([*key,mode,"LEGACY_ARCHIVE_MISSING_REAL_INDEX"])
    result={
        "total_plot_dates":len(set(old)|set(gen)),
        "archive_dates":len(old),
        "generated_dates":len(gen),
        "archive_only_dates":len(set(old)-set(gen)),
        "required_preview_images":8*len(set(old)|set(gen)),
        "incomplete_images":len(failures),
        "failures":failures
    }
    outfile=HOME/"all_preview_coverage_audit.json"
    outfile.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print("ALL_PREVIEW_COVERAGE_QA",json.dumps({k:v for k,v in result.items() if k!="failures"}))
    if failures:
        for x in failures[:20]:print("MISSING_PREVIEW_MODE",*x)
        sys.exit(1)

if __name__=="__main__":
    main()
