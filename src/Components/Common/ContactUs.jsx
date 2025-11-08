import { useState } from "react";
import "./ContactUs.css";

export default function ContactUs() {
    // local states for form data, errors, submission status
    const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
    const [errors, setErrors] = useState({});
    const [sent, setSent] = useState(false);
    const [sending, setSending] = useState(false);

    // validate form data
    const validate = () => {
        const e = {};
        if (!form.name.trim()) e.name = "Please enter your name.";
        if (!form.email.trim()) e.email = "Please enter your email.";
        else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Please enter a valid email address.";
        if (!form.subject.trim()) e.subject = "Please provide a subject.";
        if (!form.message.trim() || form.message.trim().length < 10) e.message = "Message must be at least 10 characters.";
        return e;
    };

    const handleChange = (e) => {
        setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
        setErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
    };

    const handleSubmit = (ev) => {
        ev.preventDefault();
        const e = validate();
        setErrors(e);
        if (Object.keys(e).length > 0) return;

        // Simulate submit (UI-only). Replace with API call if you have backend.
        setSending(true);
        setTimeout(() => {
            setSending(false);
            setSent(true);
            // keep form data for review or clear:
            // setForm({ name: "", email: "", subject: "", message: "" });
        }, 900);
    };

    return (
        <>
            <main className="contact-page">
                <section className="contact-hero">
                    <div className="hero-inner">
                        <h1 className="hero-title">Get in touch</h1>
                        <p className="hero-sub">Have questions, feedback, or a collab idea? We’d love to hear from you.</p>
                    </div>
                </section>

                <section className="contact-content">
                    <div className="contact-grid">

                        {/* Left: contact form */}
                        <div className="contact-card">
                            <h2 className="card-title">Send us a message</h2>

                            {sent ? (
                                <div className="sent-state">
                                    <div className="sent-emoji">🎉</div>
                                    <h3>Thanks — we got it!</h3>
                                    <p>We’ll read your message and get back within 1-2 business days.</p>
                                    <button className="btn-ghost" onClick={() => setSent(false)}>Send another</button>
                                </div>
                            ) : (
                                <form className="contact-form" onSubmit={handleSubmit} noValidate>
                                    <label className="field">
                                        <span className="label">Name</span>
                                        <input name="name" value={form.name} onChange={handleChange} className={errors.name ? "input invalid" : "input"} placeholder="Your full name" />
                                        {errors.name && <small className="error">{errors.name}</small>}
                                    </label>

                                    <label className="field">
                                        <span className="label">Email</span>
                                        <input name="email" value={form.email} onChange={handleChange} className={errors.email ? "input invalid" : "input"} placeholder="you@domain.com" />
                                        {errors.email && <small className="error">{errors.email}</small>}
                                    </label>

                                    <label className="field">
                                        <span className="label">Subject</span>
                                        <input name="subject" value={form.subject} onChange={handleChange} className={errors.subject ? "input invalid" : "input"} placeholder="What's this about?" />
                                        {errors.subject && <small className="error">{errors.subject}</small>}
                                    </label>

                                    <label className="field">
                                        <span className="label">Message</span>
                                        <textarea name="message" value={form.message} onChange={handleChange} rows={6} className={errors.message ? "textarea invalid" : "textarea"} placeholder="Write a short message..."></textarea>
                                        {errors.message && <small className="error">{errors.message}</small>}
                                    </label>

                                    <div className="form-actions">
                                        <button type="submit" className="btn-primary" disabled={sending}>
                                            {sending ? "Sending..." : "Send Message"}
                                        </button>
                                        <button type="button" className="btn-ghost" onClick={() => setForm({ name: "", email: "", subject: "", message: "" })} disabled={sending}>Reset</button>
                                    </div>
                                </form>
                            )}
                        </div>

                        {/* Right: contact info / socials */}
                        <aside className="info-column">
                            <div className="info-card">
                                <h3 className="info-title">Contact Info</h3>
                                <p className="info-line"><strong>Email:</strong> <a href="mailto:hello@opencodelabs.dev">hello@opencodelabs.dev</a></p>
                                <p className="info-line"><strong>Support:</strong> <a href="mailto:support@opencodelabs.dev">support@opencodelabs.dev</a></p>
                                <p className="info-line"><strong>Phone:</strong> +91 90000 00000</p>
                                <p className="info-line"><strong>Hours:</strong> Mon—Fri, 9:00 — 18:00</p>
                            </div>

                            <div className="info-card">
                                <h3 className="info-title">Follow Us</h3>
                                <div className="socials">
                                    <a className="social" href="#" aria-label="Twitter">t</a>
                                    <a className="social" href="#" aria-label="LinkedIn">in</a>
                                    <a className="social" href="#" aria-label="Github">gh</a>
                                </div>
                            </div>

                            <div className="info-card">
                                <h3 className="info-title">Location</h3>
                                <p className="info-line">Remote-first • Based in India</p>
                                <div className="map-placeholder" role="img" aria-label="Map placeholder">📍</div>
                            </div>

                        </aside>
                    </div>
                </section>

                <footer className="contact-footer">
                    <p>Prefer email? Send a note to <a href="mailto:hello@opencodelabs.dev">hello@opencodelabs.dev</a>.</p>
                    <p className="muted">We aim to reply within 48 hours.</p>
                </footer>
            </main>
        </>
    );
}
