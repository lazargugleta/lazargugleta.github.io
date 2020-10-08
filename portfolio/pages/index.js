import { useState } from 'react';
import Head from 'next/head'
import Link from 'next/link'
import styles from '../styles/Home.module.css'

import styled from 'styled-components';

const Navigation = styled.nav`
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: 2rem;
  align-items: center;
`;

const MiddleSectionContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-transform: uppercase;
`;

const Logo = styled.span`
  font-family: 'Lato','Helvetica','Arial', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #222222;

`;

const StyledLink = styled(Link)`
  font-family: 'Lato','Helvetica','Arial', sans-serif;
  font-weight: 700;
  display: block;
  letter-spacing: 0.05em;
  color: #222222;
  margin-left: 2rem;
`;

export default function Home() {
  return (
    <div>
      <Head>
        <title>Create Next App</title>
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&display=swap" rel="stylesheet"></link>
      </Head>
      <Navigation>
        <Logo>Lazar Gugleta</Logo>
          <MiddleSectionContainer>
          <StyledLink href="/articles">Articles</StyledLink>
          <StyledLink href="/">About Me</StyledLink>
          <StyledLink href="/">Social</StyledLink>
          </MiddleSectionContainer>
        <Logo>Newsletter</Logo>
      </Navigation>
    </div>
  )
}