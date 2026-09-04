# The one chart on the screen: items sales per day across the window,
# against the previous window's daily average. One series, one colour --
# position carries the meaning, so nothing is recoloured.
#
# The series is fixed here rather than in the markup so the arithmetic can
# be checked: it must sum to the 148,600,000 the strip claims, and its
# last nine days must sum to the 27,900,000 the sentence claims.

DAYS = [
    # 6 Aug -- 26 Aug. Sundays (9, 16, 23 Aug) are the near-zero bars.
    ("06 Aug", 5_980_000), ("07 Aug", 7_240_000), ("08 Aug", 6_120_000),
    ("09 Aug",   420_000),
    ("10 Aug", 8_050_000), ("11 Aug", 6_410_000), ("12 Aug", 5_730_000),
    ("13 Aug", 7_880_000), ("14 Aug", 6_940_000), ("15 Aug", 5_460_000),
    ("16 Aug",   420_000),
    ("17 Aug", 7_120_000), ("18 Aug", 6_290_000), ("19 Aug", 8_340_000),
    ("20 Aug", 6_010_000), ("21 Aug", 5_880_000), ("22 Aug", 7_460_000),
    ("23 Aug",   420_000),
    ("24 Aug", 6_730_000), ("25 Aug", 6_180_000), ("26 Aug", 5_620_000),
    # 27 Aug -- 4 Sep. The fall.
    ("27 Aug", 4_120_000), ("28 Aug", 3_680_000), ("29 Aug", 3_240_000),
    ("30 Aug",   380_000),
    ("31 Aug", 3_510_000), ("01 Sep", 2_980_000), ("02 Sep", 3_420_000),
    ("03 Sep", 3_150_000), ("04 Sep", 3_420_000),
]

TOTAL      = 148_600_000     # what the strip says
FALL_FROM  = 21              # index of 27 Aug
PREV_TOTAL = 162_340_000
PREV_AVG   = PREV_TOTAL / 30

assert len(DAYS) == 30, len(DAYS)
assert sum(v for _, v in DAYS) == TOTAL, sum(v for _, v in DAYS)
assert sum(v for _, v in DAYS[FALL_FROM:]) == 27_900_000
before = sum(v for _, v in DAYS[:FALL_FROM]) / FALL_FROM
after  = sum(v for _, v in DAYS[FALL_FROM:]) / (30 - FALL_FROM)

W, H = 1058, 118          # plot box
GAP  = 4
bw   = (W - GAP * 29) / 30
top  = max(v for _, v in DAYS)

def bars(fill="#8A939C", quiet="#DCE0E4"):
    out = []
    for i, (_, v) in enumerate(DAYS):
        h = max(2, round(v / top * H, 1))
        x = round(i * (bw + GAP), 1)
        # A Sunday is not a bad day, it is a closed day. Drawn in the
        # hairline grey so it reads as absence rather than collapse.
        c = quiet if v < 1_000_000 else fill
        out.append(f'<rect x="{x}" y="{round(H-h,1)}" width="{round(bw,1)}" '
                   f'height="{h}" fill="{c}" rx="1"></rect>')
    return "\n      ".join(out)

ref_y = round(H - PREV_AVG / top * H, 1)

svg = f'''<svg class="ch" viewBox="0 0 {W} {H+1}" width="{W}" height="{H+1}" role="img"
     aria-label="Items sales per day, 6 August to 4 September">
      {bars()}
      <line x1="0" y1="{ref_y}" x2="{W}" y2="{ref_y}" stroke="#59626B"
        stroke-width="1" stroke-dasharray="3 3"></line>
    </svg>'''

open("_chart.svg", "w").write(svg)

labels = [0, 6, 13, 21, 29]
ticks = "".join(
    f'<span style="left:{round(i*(bw+GAP)/W*100,3)}%">{DAYS[i][0]}</span>'
    for i in labels)
open("_ticks.html", "w").write(f'<div class="ch-x">{ticks}</div>')

print(f"sum          {sum(v for _,v in DAYS):,}")
print(f"before 27Aug {before:,.0f}/day over {FALL_FROM} days")
print(f"from 27 Aug  {after:,.0f}/day over {30-FALL_FROM} days")
print(f"prev avg     {PREV_AVG:,.0f}/day   ref y={ref_y}")
print(f"drop         {(1-after/before)*100:.0f}% day-on-day")
print(f"period delta {(TOTAL-PREV_TOTAL)/PREV_TOTAL*100:+.1f}%")
