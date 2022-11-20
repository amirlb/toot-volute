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

class Machine {
    #program;
    #debugView;
    #threads;
    #currentThread;

    constructor(program, debugView) {
        this.#program = program;
        this.#debugView = debugView;
        this.#threads = [];
        this.#currentThread = 0;
    }

    startThread(name, startLocation, input) {
        if (startLocation === null)
            return;
        this.#threads.push(new Thread(name, this.#program, startLocation, input, this.#debugView));
    }

    startMainThread() {
        this.startThread('main', this.#program.getStartLocation(), []);
    }

    isRunning() {
        return this.#threads.length > 0;
    }

    isFinished() {
        if (this.isRunning())
            return false;
        if (this.#program.getClickHandlerLocations().length > 0)
            return false;

        // No running threads and no event handlers
        return true;
    }

    step() {
        if (!this.isRunning())
            return;

        this.#threads[this.#currentThread].step();
        if (!this.#threads[this.#currentThread].isRunning()) {
            this.#threads.splice(this.#currentThread, 1);
            if (this.#currentThread >= this.#threads.length)
                this.#currentThread = 0;
        }
    }
}

function setupHandlers(program, machine) {
    document.getElementById('toot').addEventListener('click', (event) => {
        if (event.target.tagName.toLowerCase() !== 'span')
            return;
        const clickLocation = { row: 0, col: -1 };
        for (let node = event.target; node !== null; node = node.previousSibling) {
            if (node.tagName.toLowerCase() === 'br')
                clickLocation.row++;
            else if (clickLocation.row === 0)
                clickLocation.col++;
        }
        for (const startLocation of program.getClickHandlerLocations()) {
            const location = `${clickLocation.row + 1}:${clickLocation.col + 1}`;
            const threadName = `mouse:${location}`;
            machine.startThread(threadName, startLocation, [location]);
        }
        while (machine.isRunning())
            machine.step();
        program.updateView();
    });
    // TODO: implement time and keyboard event handlers
}

async function onRun() {
    const programText = document.getElementById('toot-input').value;
    document.getElementById('toot-input').classList.add('hidden');
    document.getElementById('toot').classList.remove('hidden');
    const programView = await ProgramView.create(document.getElementById('toot'));

    document.getElementById('buttons').classList.add('hidden');
    programView.setProgram(programText);
    const program = new Program(programView, false);
    const machine = new Machine(program, null);
    setupHandlers(program, machine);
    machine.startMainThread();
    while (!machine.isRunning())
        machine.step();
    program.updateView();
}

let isFastForward = false;

function stepAutomatically(machine) {
    if (!machine.isRunning())
        isFastForward = false;
    if (!isFastForward) {
        document.getElementById('fast').innerText = 'FF';
        document.getElementById('fast').setAttribute('running', false);
        return;
    }

    document.getElementById('fast').innerText = '🏃 FF';
    document.getElementById('step').click();
    setTimeout(() => {stepAutomatically(machine);}, 100);
}

async function onDebug() {
    const programText = document.getElementById('toot-input').value;
    document.getElementById('toot-input').classList.add('hidden');
    document.getElementById('toot').classList.remove('hidden');
    const programView = await ProgramView.create(document.getElementById('toot'));

    const debugView = new DebugView(document.getElementById('toot'), document.getElementById('internals'));
    document.getElementById('run').classList.add('hidden');
    document.getElementById('debug').classList.add('hidden');
    document.getElementById('step').classList.remove('hidden');
    document.getElementById('fast').classList.remove('hidden');

    programView.setProgram(programText)
    const program = new Program(programView, true);
    const machine = new Machine(program, debugView);

    document.getElementById('toot').addEventListener('click', (event) => {
        if (event.target.tagName.toLowerCase() !== 'span')
            return;
        const clickLocation = { row: 0, col: -1 };
        for (let node = event.target; node !== null; node = node.previousSibling) {
            if (node.tagName.toLowerCase() === 'br')
                clickLocation.row++;
            else if (clickLocation.row === 0)
                clickLocation.col++;
        }
        for (const startLocation of program.getClickHandlerLocations()) {
            const location = `${clickLocation.row + 1}:${clickLocation.col + 1}`;
            const threadName = `mouse:${location}`;
            machine.startThread(threadName, startLocation, [location]);
        }
        if (machine.isRunning())
            document.getElementById('step').disabled = false;
    });

    machine.startMainThread();
    document.getElementById('step').addEventListener('click', () => {
        machine.step();
        if (!machine.isRunning())
            document.getElementById('step').disabled = true;
    });
    document.getElementById('fast').addEventListener('click', () => {
        isFastForward = !isFastForward;
        document.getElementById('fast').setAttribute('running', isFastForward);
        stepAutomatically(machine);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('run').addEventListener('click', onRun);
    document.getElementById('toot-input').addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey))
            onRun();
    });
    document.getElementById('debug').addEventListener('click', onDebug);
});
