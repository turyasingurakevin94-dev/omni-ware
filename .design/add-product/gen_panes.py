BASICS = '''          <p class="tb-lede">A product is the name the rest of the shop points at — the price book,
            quotes, stock, and the agent app. <b>Only the name is required</b>; every other section
            can be left as it stands.</p>
          <div class="tb-scroll">
          <div class="f-stack" style="gap:14px;">
            <div>
              <div class="f-lab">Product name<span class="req">Required</span></div>
              <div class="f-in big foc" style="margin-top:6px;">Iron sheets — G28, 3m box profile<span class="car"></span></div>
              <div class="f-hint">Written exactly like this on quotes, the catalogue and the agent app.</div>
            </div>
            <div>
              <div class="f-lab" style="margin-bottom:7px;">Sold as</div>
              <div class="sold">
                <div class="sold-o"><span class="rd"></span>
                  <span><span class="sold-t">One item</span>
                    <span class="sold-d">A single thing, with one set of prices.</span></span></div>
                <div class="sold-o on"><span class="rd"></span>
                  <span><span class="sold-t">Sizes or options</span>
                    <span class="sold-d">Each priced and searched on its own. <em>Builds the Variants section.</em></span></span></div>
              </div>
            </div>
            <div class="f-row2">
              <div><div class="f-lab">Category</div><div class="f-in" style="margin-top:6px;">Building materials<span class="dd"></span></div></div>
              <div><div class="f-lab">Sub-category</div><div class="f-in" style="margin-top:6px;">Roofing<span class="dd"></span></div></div>
            </div>
            <div>
              <div class="f-lab">Short description<span class="ct">41 / 120</span></div>
              <div class="f-in" style="margin-top:6px;">Gauge 28 box profile, 3 metres, per sheet</div>
            </div>
            <div>
              <div class="f-lab">Notes</div>
              <div class="f-in ph" style="margin-top:6px;">Optional — for yourselves, not the customer</div>
            </div>
          </div>
          </div>'''

PHOTO_SET = '''          <p class="tb-lede">Shown on the catalogue, the item picker and the agent app —
            the fastest way to tell two similar items apart on a shelf. <b>Optional.</b></p>
          <div class="tb-scroll">
            <div style="display:flex;gap:20px;align-items:flex-start;">
              <div class="pw-set"><svg viewBox="0 0 24 24"><path d="M4 16l4.5-4.5a2 2 0 0 1 2.8 0L16 16M14 14l1.5-1.5a2 2 0 0 1 2.8 0L21 16M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM9 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg></div>
              <div style="min-width:0;">
                <p class="ph-name">iron-sheets-g28-blue.jpg</p>
                <p class="ph-meta"><span class="mono">1200 × 900</span> · <span class="mono">184 KB</span> · in the media library since 12 Aug</p>
                <div style="display:flex;gap:8px;margin-top:12px;">
                  <span class="btn btn-ghost ow-sm">Replace</span>
                  <span class="btn btn-ghost ow-sm">Remove</span>
                  <span class="btn btn-ghost ow-sm">Open in the library</span>
                </div>
                <p class="f-hint" style="margin-top:14px;max-width:52ch;">Every variant uses this
                  unless it is given one of its own, in the Variants section.</p>
              </div>
            </div>
          </div>'''

MARKUP = '''          <p class="tb-lede">Added on top of a supplier's price to <b>suggest</b> a selling price in
            Compare Prices. It never sets one, and it never touches a price already agreed. A variant
            with no rule of its own follows what is set here.</p>
          <div class="tb-scroll">
            <div class="f-row2" style="max-width:560px;">
              <div>
                <div class="f-lab">On the wholesale price</div>
                <div style="display:grid;grid-template-columns:1fr 96px;gap:8px;margin-top:6px;">
                  <div class="f-in">Percentage<span class="dd"></span></div><div class="f-in">18 %</div></div>
                <div class="f-hint">A sheet bought at <span class="mono">32,000</span> is suggested at <span class="mono">37,760</span>.</div>
              </div>
              <div>
                <div class="f-lab">On the retail price</div>
                <div style="display:grid;grid-template-columns:1fr 96px;gap:8px;margin-top:6px;">
                  <div class="f-in">Percentage<span class="dd"></span></div><div class="f-in">12 %</div></div>
                <div class="f-hint">A sheet bought at <span class="mono">35,000</span> is suggested at <span class="mono">39,200</span>.</div>
              </div>
            </div>
          </div>'''

AGENT = '''          <p class="tb-lede">A share of <b>your margin</b> on this product, not a cut off its price.
            50% gives an agent half of what you would have made; 100% gives all of it and they pay
            exactly your cost. <b>They can never pay less than that.</b> Blank follows the shop-wide
            default in Presets, and it affects the standalone agent app only — never your own quotes.</p>
          <div class="tb-scroll">
            <div class="f-row2" style="max-width:560px;">
              <div><div class="f-lab">Wholesale</div>
                <div class="f-in ph" style="margin-top:6px;">Shop default — 30%</div>
                <div class="f-hint">On a <span class="mono">5,760</span> margin an agent keeps <span class="mono">1,728</span>.</div></div>
              <div><div class="f-lab">Retail</div>
                <div class="f-in ph" style="margin-top:6px;">Shop default — 30%</div>
                <div class="f-hint">On a <span class="mono">4,200</span> margin an agent keeps <span class="mono">1,260</span>.</div></div>
            </div>
          </div>'''
