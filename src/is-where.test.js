const {h, Component} = require('preact');

const {isWhere} = require('./is-where');

it('tests tag names', () => {
  expect(isWhere({type: 'div'})(<div />)).toBeTruthy();
});

it('tests class names', () => {
  const testClass = isWhere({props: {class: 'test'}});
  expect(testClass(<div class="test" />)).toBeTruthy();
  expect(testClass(<div class="nottest" />)).toBeFalsy();
  expect(testClass(<div class="nottest and test" />)).toBeTruthy();
  expect(testClass(<div className={null} />)).toBeFalsy();
  expect(testClass(<div className="test" />)).toBeTruthy();
});

it('tests Component names', () => {
  class Node extends Component {}
  const NodelessConst = () => {};
  function NodelessFunc() {}
  function DisplayNamedFunc() {}
  DisplayNamedFunc.displayName = 'displayName';

  expect(isWhere({type: 'Node'})(<Node />)).toBeTruthy();
  expect(isWhere({type: 'NodelessConst'})(<NodelessConst />)).toBeTruthy();
  expect(isWhere({type: 'NodelessFunc'})(<NodelessFunc />)).toBeTruthy();
  expect(isWhere({type: 'displayName'})(<DisplayNamedFunc />)).toBeTruthy();
});

it('tests vdom names', () => {
  class Node extends Component {}
  const NodelessConst = () => {};
  function NodelessFunc() {}
  function DisplayNamedFunc() {}
  DisplayNamedFunc.displayName = 'displayName';

  expect(isWhere(<Node />)(<Node />)).toBeTruthy();
  expect(isWhere(<NodelessConst />)(<NodelessConst />)).toBeTruthy();
  expect(isWhere(<NodelessFunc />)(<NodelessFunc />)).toBeTruthy();
  expect(isWhere(<DisplayNamedFunc />)(<DisplayNamedFunc />)).toBeTruthy();
});



it('tests nested attributes', () => {
  expect(isWhere({props: {class: 'class'}})(<div class="class" />))
    .toBeTruthy();
});
