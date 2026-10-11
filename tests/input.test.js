import test from 'node:test';
import assert from 'node:assert/strict';
import { InputHandler } from '../js/InputHandler.js';
import { fakeTarget } from './helpers.js';

function setup() {
    const target = fakeTarget();
    const input = new InputHandler(target);
    input.attach();
    return { target, input };
}

test('клавиша удерживается, пока не отпущена', () => {
    const { target, input } = setup();
    target.dispatch('keydown', { code: 'KeyD' });
    assert.equal(input.isDown('right'), true);
    target.dispatch('keyup', { code: 'KeyD' });
    assert.equal(input.isDown('right'), false);
});

test('две клавиши одного действия: отпускание одной не сбрасывает действие', () => {
    const { target, input } = setup();
    target.dispatch('keydown', { code: 'KeyA' });
    target.dispatch('keydown', { code: 'ArrowLeft' });
    target.dispatch('keyup', { code: 'KeyA' });
    assert.equal(input.isDown('left'), true);
});

test('wasPressed живёт до конца шага', () => {
    const { target, input } = setup();
    target.dispatch('keydown', { code: 'Space' });
    assert.equal(input.wasPressed('jump'), true);
    input.endStep();
    assert.equal(input.wasPressed('jump'), false);
    assert.equal(input.isDown('jump'), true);
});

test('автоповтор клавиши не считается новым нажатием', () => {
    const { target, input } = setup();
    target.dispatch('keydown', { code: 'Space' });
    input.endStep();
    target.dispatch('keydown', { code: 'Space', repeat: true });
    assert.equal(input.wasPressed('jump'), false);
});

test('consume забирает нажатие', () => {
    const { target, input } = setup();
    target.dispatch('keydown', { code: 'Escape' });
    assert.equal(input.consume('pause'), true);
    assert.equal(input.consume('pause'), false);
});

test('неигровые клавиши игнорируются', () => {
    const { target, input } = setup();
    target.dispatch('keydown', { code: 'KeyQ' });
    assert.equal(input.pressed.size, 0);
});

test('preventDefault вызывается только при capture', () => {
    const { target, input } = setup();
    let prevented = 0;
    const event = { code: 'Space', preventDefault: () => { prevented++; } };
    target.dispatch('keydown', event);
    assert.equal(prevented, 0);
    input.capture = true;
    target.dispatch('keyup', event);
    assert.equal(prevented, 1);
});

test('потеря фокуса окна отпускает все клавиши', () => {
    const { target, input } = setup();
    target.dispatch('keydown', { code: 'KeyD' });
    target.dispatch('blur');
    assert.equal(input.isDown('right'), false);
});

test('attach не дублирует обработчики, detach снимает все', () => {
    const { target, input } = setup();
    input.attach();
    assert.equal(target.count(), 3);
    target.dispatch('keydown', { code: 'KeyD' });
    input.detach();
    assert.equal(target.count(), 0);
    assert.equal(input.isDown('right'), false);
});
