// Footer.jsx
import React from "react";
import styles from "./Footer.module.css";
import { Link } from "react-router";

export default function Footer() {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.container}>
        {/* BRAND / LOGO */}
        <div className={styles.brand}>
          <div className={styles.logoWrap} aria-hidden="true">
            {/* simple inline geometric logo using SVG */}
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="48" height="48" rx="8" fill="#615fff"/>
              <path d="M14 32L24 16L34 32H14Z" fill="#fff"/>
            </svg>
          </div>
          <div className={styles.brandText}>
            <strong className={styles.title}>
              <Link to="/">OpenCodeLabs</Link>
            </strong>
            <p className={styles.tag}>Learn · UpSkill · Succeed</p>
          </div>
        </div>

        {/* LINKS GROUPS */}
        <div className={styles.linksGrid}>
          <nav aria-label="Footer navigation" className={styles.col}>
            <h4 className={styles.colTitle}>Product</h4>
            <ul className={styles.linkList}>
              <li><a href="/courses">Courses</a></li>
            </ul>
          </nav>

          <div className={styles.col}>
            <h4 className={styles.colTitle}>Company</h4>
            <ul className={styles.linkList}>
              <li><a href="/about-us">About Us</a></li>
              <li><a href="/contact-us">Contact Us</a></li>
            </ul>
          </div>

          <div className={styles.col}>
            <h4 className={styles.colTitle}>Support</h4>
            <ul className={styles.linkList}>
              <li><a href="/help">Help Center</a></li>
              <li><a href="/faq">FAQ</a></li>
              <li><a href="/terms">Terms</a></li>
              <li><a href="/privacy">Privacy</a></li>
            </ul>
          </div>

          {/* Newsletter (UI only) */}
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Stay in touch</h4>
            <p className={styles.small}>Get short tips, new courses, and occasional discounts.</p>

            <form className={styles.newsForm} onSubmit={(e) => e.preventDefault()} aria-label="Subscribe to newsletter">
              <label htmlFor="footer-email" className={styles.visuallyHidden}>Email address</label>
              <input
                id="footer-email"
                type="email"
                placeholder="you@domain.com"
                className={styles.input}
                aria-label="Email address"
              />
              <button type="button" className={styles.ghostBtn}>Subscribe</button>
            </form>

            <div className={styles.social}>
              <a href="https://twitter.com" aria-label="Twitter" className={styles.iconLink}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M22 5.92c-.66.3-1.37.5-2.11.6a3.66 3.66 0 0 0-6.23 3.33A10.4 10.4 0 0 1 3.16 4.6a3.66 3.66 0 0 0 1.13 4.88c-.53 0-1.03-.16-1.47-.4v.04c0 1.77 1.26 3.26 2.94 3.6-.5.13-1.02.17-1.56.06.44 1.37 1.7 2.37 3.2 2.4A7.34 7.34 0 0 1 2 18.57a10.36 10.36 0 0 0 5.6 1.65c6.72 0 10.4-5.64 10.4-10.54v-.48A7.2 7.2 0 0 0 22 5.92z"/>
                </svg>
              </a>
              <a href="https://www.linkedin.com" aria-label="LinkedIn" className={styles.iconLink}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.11 1 2.5 1 4.98 2.12 4.98 3.5zM0 8.25h5v15H0v-15zM8.5 8.25h4.8v2h.07c.67-1.27 2.3-2.6 4.74-2.6 5.07 0 6 3.22 6 7.41V24h-5V16c0-1.95-.04-4.46-2.72-4.46-2.72 0-3.13 2.12-3.13 4.32V24h-5v-15z"/>
                </svg>
              </a>
              <a href="https://github.com" aria-label="GitHub" className={styles.iconLink}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.73.5.98 5.25.98 11.52c0 4.6 2.99 8.5 7.14 9.89.52.1.71-.23.71-.5 0-.25-.01-.92-.01-1.8-2.9.64-3.52-1.4-3.52-1.4-.48-1.23-1.17-1.56-1.17-1.56-.96-.66.07-.65.07-.65 1.06.07 1.62 1.09 1.62 1.09.94 1.62 2.46 1.15 3.06.88.09-.68.37-1.15.67-1.41-2.32-.26-4.76-1.16-4.76-5.16 0-1.14.39-2.06 1.03-2.79-.1-.26-.45-1.3.1-2.7 0 0 .83-.27 2.73 1.05a9.45 9.45 0 0 1 2.48-.34c.84 0 1.69.11 2.48.34 1.9-1.33 2.73-1.05 2.73-1.05.55 1.4.2 2.44.1 2.7.64.73 1.03 1.65 1.03 2.79 0 4.01-2.46 4.89-4.8 5.15.38.33.72.98.72 1.98 0 1.43-.01 2.58-.01 2.93 0 .27.19.6.72.5 4.14-1.39 7.12-5.29 7.12-9.89C23.02 5.25 18.27.5 12 .5z"/>
                </svg>
              </a>
            </div>
          </div>
        </div> {/* /linksGrid */}
      </div>

      {/* bottom bar */}
      <div className={styles.bottom}>
        <div className={styles.bottomInner}>
          <small className={styles.copy}>© {new Date().getFullYear()} OpenCodeLabs — All rights reserved.</small>
          <div className={styles.policyLinks}>
            <a href="/terms">Terms</a>
            <span aria-hidden="true" className={styles.dot}>•</span>
            <a href="/privacy">Privacy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
