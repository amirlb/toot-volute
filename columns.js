"use strict";

// Toot Volute - an interpreter for Mastodon posts, following Luci for Chai Tea
// Copyright (C) 2022 Amir Livne Bar-on
// 
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

function drawColumns() {
    // Template taken from
    //     https://ascii.co.uk/art/column
    // where it's credited to
    //     Jouni Marttila - Normand Veilleux - Evan M Corcoran
    const HEAD = ['  ___     ___', ' / _ \\===/ _ \\', '( (.\\ oOo /.) )', ' \\__/=====\\__/'];
    const BULK = '    |||||||';
    const BASE = ['    (oOoOo)', '    J%%%%%L', '   ZZZZZZZZZ'];

    // Maybe use smaller ones from the same source?
    // const HEAD = [' ___ ', '@   @'];
    // const BULK = ' ||| ';
    // const BASE = ['(___)'];

    for (const elt of document.getElementsByClassName('column')) {
        elt.innerText = [...HEAD, ...BASE].join('\n');
        const minHeight = elt.offsetHeight;
        elt.innerText = [...HEAD, BULK, ...BASE].join('\n');
        const lineHeight = elt.offsetHeight - minHeight;
        const nLines = Math.trunc((window.innerHeight - minHeight - 1) / lineHeight);
        const lines = [];
        for (const line of HEAD)
            lines.push(line);
        for (let i = 0; i < nLines; i++)
            lines.push(BULK);
        for (const line of BASE)
            lines.push(line);
        elt.innerText = lines.join('\n');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    drawColumns();
    window.addEventListener('resize', drawColumns);
});
