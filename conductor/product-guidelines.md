# Product Guidelines

## 1. Core Principles
These guidelines ensure consistency and quality across the `bzr-dial-menu` component and the broader "BzZrRR.link webwork" library.

- **Precision:** All features, documentation, and communications must be technically accurate and unambiguous.
- **Performance:** Components must be highly performant, with a focus on low-latency interactions and efficient rendering.
- **Tactical Design:** The UI should be functional, purposeful, and feel like a high-tech tool, aligning with the "Tactical UI" and espionage themes.

## 2. Tone and Voice
- **Style:** Technical and Precise.
- **Audience:** The primary audience is developers and UI/UX designers. Communication should be professional, direct, and focused on functionality and implementation.
- **Examples:**
    - **Use:** "The component utilizes a hybrid canvas/DOM rendering strategy to optimize performance."
    - **Avoid:** "You'll love how our cool new component draws things super fast!"

## 3. Visual Identity
- **Aesthetic:** Futuristic and Sleek.
- **Inspiration:** The visual design is inspired by high-tech espionage and "wetwork" themes, presenting the UI as a "tactical" tool.
- **Key Elements:**
    - **Themes:** Dark themes are preferred, with high-contrast, glowing accents (like the default `var(--primary)` green).
    - **Effects:** Subtle animations, glowing effects on active states, and a clean, digital feel are encouraged.
    - **Typography:** Use modern, clean, sans-serif fonts (like the current 'Space Grotesk') that are highly legible and have a slightly technical feel.
- **Branding:** As the launch component of "BzZrRR.link webwork", its visual identity sets the standard for the entire library. It should feel modern, sophisticated, and tool-like.

## 4. Component Design and Customization
- **API Design:** Component attributes and JavaScript APIs should be clearly named, well-documented, and follow established web standards.
- **Styling with Design Tokens:** Where possible, styling should be implemented using design tokens (e.g., via CSS Custom Properties) to ensure consistency and facilitate customization.
- **Extensibility:** Prioritize extensibility through slots to allow developers to adapt the component to their needs without sacrificing the core experience.
- **Feedback:** User interactions should provide clear feedback through visual cues (e.g., glows, transforms), and where appropriate, haptic or audio feedback.
- **Online Configurator:** Customization is primarily handled by an online tool where users can configure the component's appearance and behavior after purchase.

## 5. Monetization and Distribution
- **Access Control:** The component is a commercial product, with access granted via an API key.
- **Configuration Delivery:**
    - The online configurator generates a user-specific configuration file.
    - This configuration is uploaded to an IPFS node.
    - The component will fetch its unique configuration from IPFS using a Content Identifier (CID) that is requested and authorized via the user's API key.
