import { useState } from 'react';
import Head from 'next/head'
import Link from 'next/link'
import styles from '../styles/Home.module.css'

import styled from 'styled-components';

import GitHubLogo from '../static/assets/svg/github.svg';
import LinkedInLogo from '../static/assets/svg/linkedin.svg';
import GmailLogo from '../static/assets/svg/gmail.svg';
import MediumLogo from '../static/assets/svg/medium.svg';
import InstagramLogo from '../static/assets/svg/instagram.svg';
import TwitterLogo from '../static/assets/svg/twitter.svg';

const Container = styled.div`
  height: 100vh;
  width: 100vw;
  display: grid;
  align-items: center;
  justify-content: center;
  background-image: url(${require('../static/assets/images/background.png')});
  background-repeat: no-repeat;
  background-size: cover;
`;

const Navigation = styled.nav`
  width: auto;
  display: flex;
  align-items: center;
  justify-content: space-around;

  & > * {
    font-family: 'Lato','Helvetica','Arial', sans-serif;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: white;
  }

  margin-bottom: 3rem;
`;

const MiddleSectionContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-transform: uppercase;

  & > * {
    margin-left: 2rem;
  }

  & > *:hover {
    opacity: 0.6;
    transition: opacity 0.25s;
  }

  & > *:first-child {
    margin-left: 0rem;
  }
`;

const Logo = styled.h1`
  font-family: 'Lato','Helvetica','Arial', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 4rem;
  letter-spacing: 0.1rem;
  color: white;
  margin-bottom: 3rem;
`;

const SocialContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;

  & > * {
    margin-left: 1rem;
  }

  & > *:first-child {
    margin-left: 0rem;
  }
`;

const SocialIcon = styled.svg`
  height: 1.2rem;
  width: 1.2rem;
  fill: white;

  &:hover {
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.25s;
  }
`;

const StyledLink = styled(Link)`

`;

export default function Home() {
  return (
    <div>
      <Head>
        <title>Lazar Gugleta</title>
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&display=swap" rel="stylesheet"></link>
      </Head>
      <Container>
        <div>
          <Logo>Lazar Gugleta</Logo>
          <Navigation>
            <StyledLink href="/articles">Articles</StyledLink>
            <StyledLink href="/">About Me</StyledLink>
            <StyledLink href="/">Social</StyledLink>
          </Navigation>
          <SocialContainer>
            <StyledLink href="/articles"><SocialIcon as={GitHubLogo} /></StyledLink>
            <StyledLink href="/articles"><SocialIcon as={GmailLogo} /></StyledLink>
            <StyledLink href="/articles"><SocialIcon as={LinkedInLogo} /></StyledLink>
            <StyledLink href="/articles"><SocialIcon as={MediumLogo} /></StyledLink>
            <StyledLink href="/articles"><SocialIcon as={InstagramLogo} /></StyledLink>
            <StyledLink href="/articles"><SocialIcon as={TwitterLogo} /></StyledLink>
          </SocialContainer>
        </div>
      </Container>
    </div>
  )
}