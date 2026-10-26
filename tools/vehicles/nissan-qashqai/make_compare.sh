#!/bin/sh
# make_compare.sh renders/dir ref/dir : compare.png = brochure line drawings (row 1), model (row 2), overlay (row 3); same framing, orthographic side/front/rear.
# Needs ImageMagick. Brochure crops use per-axis scale (horizontal px/m from the dimension arrows, vertical so that roof = 1.590 m, like the traced profile).
R="$1"; P="$2"; cd "$R" || exit 1
magick "$P/x41s.png" -crop 1192x522+391+711 +repage -resize 1300x550! r_side.png
magick "$P/x42s.png" -crop 775x591+958+375 +repage -resize 1040x760! r_front.png
magick "$P/x42s.png" -crop 791x597+124+367 +repage -resize 1040x760! r_rear.png
for v in side front rear; do
  magick o_$v.png -background white -alpha remove -alpha off m_$v.png
  magick r_$v.png m_$v.png -compose multiply -composite ov_$v.png
done
magick \( r_side.png -resize 50% \) \( r_front.png -resize 50% \) \( r_rear.png -resize 50% \) +append r_row.png
magick \( m_side.png -resize 50% \) \( m_front.png -resize 50% \) \( m_rear.png -resize 50% \) +append m_row.png
magick \( ov_side.png -resize 50% \) \( ov_front.png -resize 50% \) \( ov_rear.png -resize 50% \) +append o_row.png
magick r_row.png m_row.png o_row.png -append compare.png
