import React from 'react';
import { mount } from '@cypress/react';
import { Button } from '../../src/components/ui/button';

describe('Button', () => {
  it('renders with default text', () => {
    mount(<Button>Click Me</Button>);
    cy.get('button').should('contain', 'Click Me');
  });
});
