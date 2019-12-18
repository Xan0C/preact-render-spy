const {h} = require('preact');
const {selToWhere} = require('./sel-to-where');
const {ATTRIBUTE_PRESENT} = require('./is-where');

it('node names', () => {
  expect(selToWhere('div')).toEqual({type: 'div'});
  expect(selToWhere('Node')).toEqual({type: 'Node'});
});

it('classes', () => {
  expect(selToWhere('.class')).toEqual({props: {class: 'class'}});
});

it('ids', () => {
  expect(selToWhere('#id')).toEqual({props: {id: 'id'}});
});

it('attributes', () => {
  expect(selToWhere('[attr]')).toEqual({props: {attr: ATTRIBUTE_PRESENT}});
  expect(selToWhere('[onClick]')).toEqual({props: {onClick: ATTRIBUTE_PRESENT}});
});

it('vdom', () => {
  expect(selToWhere(<div testAttr={true} />)).toEqual(<div testAttr={true} />);
});
