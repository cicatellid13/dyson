# Factory Planner

Client-side, single-stage planning. Both the standalone page and item accordion use one calculator with an editable target that defaults to the selected belt's capacity. There are no named modes in the interface. Changing belts follows the default until a target is manually entered; “Fill one belt” restores automatic sizing.

The standalone selection/target survives navigation for the current session. Last-used facility (one ID, not per recipe), belt, sorter and reach are validated and stored on this device in localStorage. Incompatible facility families fall back to a valid option without overwriting the saved choice. Equipment preferences are shared between inline and standalone calculators. No database or Logistics Network changes; production plans and targets are never persisted.

## Rates and provenance

Nominal belt rates: 6/12/30 items/s. Sorters I/II/III: 1.5/3/6 trips/s at one-grid reach, divided by reach (1–3). One item per trip, no stacking upgrades. Actual pickup timing can lower throughput; no guarantee of a tile-perfect build.

Facility crafting speeds: assemblers .75/1/1.5/3; smelters 1/2/3; chemical plants 1/2; refinery and collider 1; labs 1/3. Centralized in `factoryEquipment.ts`. Recipe times and quantities come exclusively from the existing catalog.

Sources checked October 27, 2026:
- FactorioLab's DSP equipment dataset (game baseline 0.10.29.21950): https://github.com/factoriolab/factoriolab/blob/main/public/data/dsp/data.json
- Firsthand blueprint author equipment reference: https://github.com/cjsworld/DysonSphere-Blueprint
- Sorter reach reference: https://dyson-sphere-program.fandom.com/wiki/Sorter

## Model and limits

Batches per second = target / selected output quantity. Each stream rate = batches × recipe quantity. Machine capacity = output quantity × facility speed / recipe seconds. Round target / capacity upward.

For each stream, allocate ceil(rate / belt rate) independent belts and ceil(rate / machines / sorter rate) sorters per machine. Use **eight sorter connections per machine as a conservative planning budget**, not a claimed game port count. The modeled layout reserves two connections on each of four sides. One-grid reach reserves a side per material; reach 2–3 permits two lanes per side (all transfers charged at the slowest selected reach). A monotone binary search increases machine count to the minimum meeting both crafting and that connection budget. If even one connection per stream exceeds the budget, return an unsupported-layout explanation. Display all inputs and all byproducts, including their own belts. Results assume evenly balanced, dedicated lanes and full power/supply.

This is rate and connection-budget planning, **not geometric blueprint validation**. Physical routing, actual building port placements, belt curvature/latitude, pickup timing, and distribution/splitter placement still need checking in game. Eight connections does not prove a layout works at the selected reach. Detailed modeling assumptions are documented here rather than shown in a planner footer; installed machine capacity is distinct from expected sustainable rate under these assumptions. Recommended machine count is minimum within this conservative model, not a universal global optimum.

Unsupported: proliferation, cargo stacking, pile sorters, fractionation/probabilistic outputs, recycling/recirculation (overlapping recipe inputs and outputs), mining/extraction, stacked labs and power generation. Unsupported recipes display explanations, never fabricated output. Conventional alternative recipes remain selectable.

## Acceptance checks

- Sidebar immediately below Logistics Network; searchable icon item picker.
- One editable target, defaulting to one belt; changing units preserves rate.
- Shared dark controls and results; embedded accordion initially collapsed and uses current item and the same controls.
- Tests cover rates, all facility families, rounding, fractions, multi-output, input belts, multiple output belts, sorter/reach limits, alternates, invalid/unsupported and impossible configurations, determinism.

Item pickers reopen with their full allowed item list while retaining the selected value. Typing starts a fresh filter; closing the menu does not clear the selection.
