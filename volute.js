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

class Interpreter {
    _performLoad(prefix) {
        for (const line of this.program) {
            for (const word of line) {
                if (word.startsWith(prefix)) {
                    this.stack.push(word.substring(prefix.length));
                    return
                }
            }
        }
    }

    _performSave(prefix) {
        const value = this.stack.pop();
        for (const line of this.program) {
            for (let i = 0; i < line.length; i++) {
                if (line[i].startsWith(prefix)) {
                    line[i] = prefix + value;
                    this._replaceContents();
                    return;
                }
            }
        }
        this.program[this.program.length - 1].push(prefix + value);
        this._replaceContents();
    }

    _performMath(operator, operand) {
        // TODO: add more operators
        const UNARY = {
            '!': function(x) {return ['', 0, '0'].includes(x) * 1;}
        };
        const BINARY = {
            '<': function(x, y) {return (x < y) * 1;},
            '>': function(x, y) {return (x > y) * 1;},
            '+': function(x, y) {return x + y;},
            '&': function(x, y) {return x & y;},
            '=': function(x, y) {return (x === y) * 1;}
        }
        if (UNARY.hasOwnProperty(operator)) {
            const arg = parseInt(this.stack.pop());
            this.stack.push(UNARY[operator](arg).toString());
        } else if (BINARY.hasOwnProperty(operator)) {
            const arg2 = (operand.length === 0) ? parseInt(this.stack.pop()) : parseInt(operand);
            const arg1 = parseInt(this.stack.pop());
            this.stack.push(BINARY[operator](arg1, arg2).toString());
        }
    }

    _jump(label) {
        for (let i = 0; i < this.program.length; i++) {
            for (let j = 0; j < this.program[i].length; j++) {
                if (this.program[i][j] === label) {
                    this.instructionPointer.line = i;
                    this.instructionPointer.word = j;
                    return;
                }
            }
        }
    }

    _findByPrefix(prefix) {
        for (let i = 0; i < this.program.length; i++)
            for (let j = 0; j < this.program[i].length; j++)
                if (this.program[i][j].startsWith(prefix))
                    return `${i}:${j}`;
    }

    _appendWord() {
        const word = this.stack.pop();
        const [line, ind] = this.stack.pop().split(':').map((x) => parseInt(x));
        this.program[line].splice(ind + 1, 0, word);
        this.stack.push(`${line}:${ind + 1}`);
        if (line === this.instructionPointer.line && ind < this.instructionPointer.word)
            this.instructionPointer.word++;
        this._replaceContents();
    }

    _deleteWord() {
        const [line, ind] = this.stack.pop().split(':').map((x) => parseInt(x));
        this.program[line].splice(ind, 1);
        this.stack.push(`${line}:${Math.min(ind, this.program[line].length - 1)}`);
        if (line === this.instructionPointer.line && ind < this.instructionPointer.word)
            this.instructionPointer.word--;
        this._replaceContents();
    }

    _addLineAfter() {
        const line = parseInt(this.stack.pop().split(':', 1));
        this.program.splice(line + 1, 0, []);
        this.stack.push(`${line + 1}:0`);
        if (line < this.instructionPointer.line)
            this.instructionPointer.line++;
        this._replaceContents();
    }
}

function setupHandlers(program) {
    // TODO: implement time, mouse and keyboard event handlers. for each one,
    //       ask the program where the volute code for handling the event is
    //       and start a new thread there if it's defined.
}

async function onRun() {
    const programText = document.getElementById('toot-input').value;
    document.getElementById('toot-input').classList.add('hidden');
    document.getElementById('toot').classList.remove('hidden');
    const programView = await ProgramView.create(document.getElementById('toot'));

    document.getElementById('buttons').classList.add('hidden');
    programView.setProgram(programText)
    const program = new Program(programView, false);
    setupHandlers(program);
    const startLocation = program.getStartLocation();
    const mainThread = new Thread('main', program, startLocation, [], null);
    while (mainThread.isRunning())
        mainThread.step();
    program.updateView();
}

let isFastForward = false;

function stepAutomatically(thread) {
    if (!thread.isRunning())
        isFastForward = false;
    if (!isFastForward) {
        document.getElementById('fast').innerText = 'FF';
        document.getElementById('fast').setAttribute('running', false);
        return;
    }

    document.getElementById('fast').innerText = '🏃 FF';
    document.getElementById('step').click();
    setTimeout(() => {stepAutomatically(thread);}, 100);
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
    // TODO: event handlers should maybe fire only when no thread is running?
    const mainThread = new Thread('main', program, program.getStartLocation(), [], debugView);
    if (!mainThread.isRunning())
        document.getElementById('step').disabled = true;
    document.getElementById('step').addEventListener('click', () => {
        mainThread.step();
        if (!mainThread.isRunning())
            document.getElementById('step').disabled = true;
    });
    document.getElementById('fast').addEventListener('click', () => {
        isFastForward = !isFastForward;
        document.getElementById('fast').setAttribute('running', isFastForward);
        stepAutomatically(mainThread);
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
