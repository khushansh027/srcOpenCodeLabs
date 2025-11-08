import React from "react";
import "./AboutUsPageStyles.css";

export default function AboutUsPage() {
    return (
        <div className="about-page">
            {/* Hero Section */}
            <section className="hero">
                <div className="hero-content">
                    <h1 className="hero-title">Empowering Developers, One Line of Code at a Time</h1>
                    <p className="hero-subtitle">
                        At <span>OpenCodeLabs.dev</span>, we’re reimagining the way the world learns software engineering.
                    </p>
                </div>
            </section>

            {/* Main Content */}
            <div className="about-container">
                <div className="about-card fade-in">
                    <h2>Our Mission</h2>
                    <p>
                        Our mission is simple — to empower individuals with real-world software
                        engineering skills that go beyond theory. We’re here to make tech
                        education accessible, practical, and inspiring.
                    </p>
                </div>

                <div className="about-card fade-in delay-1">
                    <h2>Our Story</h2>
                    <p>
                        Founded in 2023 by a group of passionate software engineers,
                        <strong> OpenCodeLabs.dev</strong> was created to bridge the gap between
                        traditional education and the ever-evolving tech industry. Our founders
                        wanted to make learning feel exciting again — not intimidating.
                    </p>
                </div>

                <div className="about-card fade-in delay-2">
                    <h2>What We Offer</h2>
                    <p>
                        From front-end to full-stack, data to DevOps — our expert-curated courses
                        are designed for learners who crave clarity and mastery. Learn at your
                        pace, practice with hands-on projects, and grow with real guidance.
                    </p>
                </div>

                <div className="about-card fade-in delay-3">
                    <h2>Our Community</h2>
                    <p>
                        At OpenCodeLabs.dev, you’re never learning alone. Join a thriving
                        community of developers, mentors, and creators. Build connections,
                        collaborate on projects, and share your coding journey with the world.
                    </p>
                </div>

                <div className="about-card fade-in delay-4">
                    <h2>Get in Touch</h2>
                    <p>
                        Have a question, idea, or collaboration in mind?
                        We’d love to hear from you — drop us a message at
                        <a href="mailto:hello@opencodelabs.dev"> hello@opencodelabs.dev</a>.
                    </p>
                </div>
            </div>

            {/* Call to Action */}
            <section className="cta-section">
                <h2>Ready to Start Learning?</h2>
                <p>Join thousands of learners building their tech careers with OpenCodeLabs.dev.</p>
                <button
                    className="cta-btn"
                    onClick={() => window.location.href = "/courses"}
                >Explore Courses</button>
            </section>
        </div>
    );
}
