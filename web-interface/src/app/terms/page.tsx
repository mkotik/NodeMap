import "./Terms.scss";

export default function TermsPage() {
  return (
    <div className="terms">
      <div className="terms__header">
        <h1 className="terms__title">Terms of Service</h1>
        <p className="terms__updated">Last updated: March 30, 2026</p>
      </div>

      <div className="terms__body">
        <section className="terms__section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using NodeMap.io, you agree to be bound by these
            Terms of Service. If you do not agree to these terms, do not use the
            service.
          </p>
        </section>

        <section className="terms__section">
          <h2>2. Description of Service</h2>
          <p>
            NodeMap.io is an AI-powered chat application that allows users to
            create branching conversations. The service connects to third-party
            language models via OpenRouter using API keys provided by you.
          </p>
        </section>

        <section className="terms__section">
          <h2>3. User Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your
            account credentials. You agree to provide accurate information when
            creating an account and to keep your information up to date.
          </p>
        </section>

        <section className="terms__section">
          <h2>4. API Keys</h2>
          <p>
            NodeMap.io requires an OpenRouter API key to function. You are
            responsible for any charges incurred through your API key. Your key
            is encrypted before storage, but you should treat it as sensitive
            information.
          </p>
        </section>

        <section className="terms__section">
          <h2>5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the service for any unlawful purpose</li>
            <li>
              Attempt to gain unauthorized access to the service or its systems
            </li>
            <li>Interfere with or disrupt the service</li>
            <li>
              Use the service to generate content that is harmful, abusive, or
              violates the rights of others
            </li>
          </ul>
        </section>

        <section className="terms__section">
          <h2>6. Intellectual Property</h2>
          <p>
            You retain ownership of the content you create using NodeMap.io. We
            do not claim any rights over your conversations or generated content.
          </p>
        </section>

        <section className="terms__section">
          <h2>7. Disclaimer of Warranties</h2>
          <p>
            NodeMap.io is provided &quot;as is&quot; without warranties of any
            kind, express or implied. We do not guarantee that the service will
            be uninterrupted, error-free, or that AI-generated responses will be
            accurate.
          </p>
        </section>

        <section className="terms__section">
          <h2>8. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, NodeMap.io shall not be
            liable for any indirect, incidental, special, or consequential
            damages arising from your use of the service.
          </p>
        </section>

        <section className="terms__section">
          <h2>9. Changes to Terms</h2>
          <p>
            We reserve the right to modify these terms at any time. Continued
            use of the service after changes constitutes acceptance of the
            updated terms.
          </p>
        </section>

        <section className="terms__section">
          <h2>10. Contact</h2>
          <p>
            If you have questions about these terms, contact us at{" "}
            <a href="mailto:maratkotik97@gmail.com">maratkotik97@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
