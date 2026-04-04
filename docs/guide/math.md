# Math Rendering

marknative renders mathematical formulas server-side using [MathJax](https://www.mathjax.org/) — no browser required. Both block-level display formulas and inline formulas are supported.

## Block Math

Wrap a formula in `$$` delimiters on its own lines to produce a centred display-style formula:

```markdown
$$
\int_a^b f'(x)\,dx = f(b) - f(a)
$$

$$
p(\mathbf{x}) = \frac{1}{(2\pi)^{d/2}|\Sigma|^{1/2}}
\exp\!\left(-\tfrac{1}{2}(\mathbf{x}-\boldsymbol{\mu})^T\Sigma^{-1}(\mathbf{x}-\boldsymbol{\mu})\right)
$$
```

Block formulas are centred horizontally within the content area and receive their own vertical spacing.

## Inline Math

Wrap a formula in single `$` delimiters to embed it inside a paragraph:

```markdown
The gradient $\nabla f = \left(\frac{\partial f}{\partial x_1}, \ldots\right)$ points in the
direction of steepest ascent. For entropy $H(X) = -\sum p \log p$, the maximum is
$\log |\mathcal{X}|$.
```

Inline formulas are baseline-aligned with the surrounding text. Formulas that extend below the baseline (fractions, large operators) expand the line height naturally without distorting adjacent runs.

## Mixed Content

Math renders correctly inside all block types:

### Inside blockquotes

```markdown
> The KL divergence $D_{\mathrm{KL}}(P\|Q) \geq 0$ is never negative (Gibbs' inequality).
>
> $$
> D_{\mathrm{KL}}(P\|Q) = \int p(x) \log \frac{p(x)}{q(x)}\,dx
> $$
```

### Inside lists

```markdown
Key identities:
- Euler's formula: $e^{i\pi} + 1 = 0$
- Bayes' theorem: $P(A|B) = P(B|A)P(A)/P(B)$
- Norm: $\|\mathbf{x}\|_2 = \sqrt{\sum x_i^2}$
```

### Inside tables

```markdown
| Formula | Name |
| :--- | :--- |
| $e^{i\pi} + 1 = 0$ | Euler's identity |
| $\nabla \times \mathbf{B} = \mu_0 \mathbf{J}$ | Ampère's law |
```

### Alongside code blocks

```markdown
The DFT $\hat{f}(\xi) = \int f(x) e^{-2\pi ix\xi}\,dx$ is computed numerically:

​```python
import numpy as np
def dft(x):
    N, n = len(x), np.arange(len(x))
    return np.exp(-2j * np.pi * n.reshape(N,1) * n / N) @ x
​```

Naïve complexity: $O(N^2)$. FFT reduces this to $O(N\log N)$.
```

## Color and Themes

Formula colors follow the active theme automatically. On dark themes (e.g. `'dark'`, `'nord'`, `'dracula'`) the formula color is taken from `theme.colors.text`, so formulas are always legible against the page background.

```ts
// Formulas render in white on dark themes
const pages = await renderMarkdown(mathDocument, { theme: 'dark' })
```

## Performance

MathJax is initialised lazily on the first render that contains a formula. After that:

- The MathJax singleton is reused across all renders — no re-initialisation overhead
- Formula SVGs are cached by their LaTeX source string — repeated formulas are rendered only once
- Cold-start overhead (first render after process start) is approximately **180 ms**
- Subsequent renders: math processing adds < 2 ms when all formulas are cached

## Supported LaTeX

marknative uses MathJax's TeX input processor. Supported packages include:

- Core TeX math mode
- `amsmath` — aligned environments, `\text`, `\DeclareMathOperator`, etc.
- `boldsymbol`, `bm` — bold math symbols
- `mathtools` — extended `amsmath`
- Standard symbol sets — Greek letters, operators, relations, arrows

For the full list of supported commands, see the [MathJax TeX support reference](https://docs.mathjax.org/en/latest/input/tex/macros/index.html).

## Notes

- The MathJax parser uses `$...$` for inline math and `$$...$$` for display math. Dollar signs in non-math contexts (e.g. `\$500`) do not need escaping — the parser requires both delimiters to be present on the same text node to trigger math mode.
- Inline math interacts with line-breaking: very wide inline formulas are not broken across lines. If a formula is wider than the content area it will overflow the right margin. Keep inline formulas concise or use display math for wide expressions.
