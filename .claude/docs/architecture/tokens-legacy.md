# Guia de Design e Cores - XixiBarato / Fraldinha Livre

## Template Base
- **Nome do Template:** Vesperr (BootstrapMade)
- **Framework CSS:** Bootstrap v5.2.3

---

## Paleta de Cores

### Cor Principal (Primaria)
| Cor | Hex | Uso |
|-----|-----|-----|
| Azul Principal | `#3498db` | Links, botoes, icones, destaques, elementos interativos |
| Azul Hover | `#5faee3` | Links em estado hover |
| Azul Hover Alternativo | `#4aa3df` | Botoes em estado hover |
| Azul Escuro | `#2383c4` | Botoes hover (variante escura) |
| Azul Claro | `#57aae1` | Back-to-top hover |
| Azul Claro (Quote Icons) | `#8bc4ea` | Icones de FAQ |
| Azul Muito Claro | `#e1f0fa` | Backgrounds de servicos, quote icons |

### Cores de Texto
| Cor | Hex | Uso |
|-----|-----|-----|
| Texto Principal | `#444444` | Texto do corpo (body) |
| Texto Escuro | `#222222` | Titulos, logo, navegacao mobile |
| Texto Cinza | `#555555` | Links de navegacao |
| Texto Cinza Medio | `#484848` | Subtitulos (hero h2), paragrafos counts |
| Texto Cinza Claro | `#888` | Texto de contato |
| Texto Cinza Muito Claro | `#999` | Subtitulos testimonials |
| Texto Alternativo | `#5e5e5e` | Card text |
| Texto Hover | `#6f6f6f` | Links hover em count-box |
| Texto Links | `#777777` | Read more links |

### Cores de Fundo (Background)
| Cor | Hex | Uso |
|-----|-----|-----|
| Branco | `#fff` / `#ffffff` | Header, backgrounds principais, cards |
| Fundo Section BG | `#f7fbfe` | Section com classe .section-bg |
| Fundo Clients | `#f3f9fd` | Secao de clientes/parceiros |
| Fundo Cinza Claro | `#f6f6f6` | Features icon-box |
| Fundo Cinza | `#f9f9f9` | Pricing boxes |
| Fundo Breadcrumbs | `#f8f8f8` | Breadcrumbs |
| Fundo Features Hover | `#eef7fc` | Features hover state |

### Cores de Estado/Feedback
| Cor | Hex | Uso |
|-----|-----|-----|
| Sucesso (Verde) | `#18d26e` | Mensagem enviada com sucesso |
| Erro (Vermelho) | `#ed3c0d` | Mensagem de erro |

### Cores Neutras
| Cor | Hex | Uso |
|-----|-----|-----|
| Preto | `black` | Titulo hero h1 |
| Cinza Escuro | `#111` | Titulos de servicos, testimonials |
| Cinza | `#aaaaaa` | Member info span (team) |
| Cinza Claro | `#bababa` | Pricing h4 span |
| Cinza Desabilitado | `#ccc` | Itens nao disponiveis (pricing) |
| Borda | `#eeeeee` / `#eee` | Bordas, divisores |

### Overlay/Transparencias
| Cor | Uso |
|-----|-----|
| `rgba(0, 0, 0, 0.1)` | Sombras, box-shadow |
| `rgba(9, 9, 9, 0.9)` | Overlay mobile navbar |
| `rgba(34, 34, 34, 0.6)` | Portfolio overlay |
| `rgba(68, 88, 144, 0.12)` | Box-shadow servicos |
| `rgba(127, 137, 161, 0.25)` | Box-shadow dropdown |
| `rgba(255, 255, 255, 0.7)` | Texto portfolio info |
| `rgba(255, 255, 255, 0.85)` | Background social team |
| `rgba(255, 255, 255, 0.9)` | Card body more-services |

---

## Tipografia

### Fontes (Google Fonts)
1. **Open Sans** - Fonte principal do corpo
   - Pesos: 300, 300i, 400, 400i, 600, 600i, 700, 700i

2. **Raleway** - Fonte para titulos (h1-h6)
   - Pesos: 300, 300i, 400, 400i, 500, 500i, 600, 600i, 700, 700i

3. **Poppins** - Fonte auxiliar (FAQ, counts)
   - Pesos: 300, 300i, 400, 400i, 500, 500i, 600, 600i, 700, 700i

### Tamanhos de Fonte
| Elemento | Tamanho | Peso |
|----------|---------|------|
| Hero H1 | 48px (desktop) / 28px (mobile) | 700 |
| Hero H2 | 24px (desktop) / 18px (mobile) | - |
| Section Title H2 | 32px | bold |
| Logo H1 | 30px | 700 |
| Navbar Links | 15px | 400 |
| Texto Padrao | 14-15px | - |

---

## Componentes de Design

### Botoes
- **Border-radius:** 50px (pill/arredondado)
- **Padding:** 10px 30px (primario) / 8px 25px (navbar)
- **Transicao:** 0.3s - 0.5s

### Cards/Boxes
- **Border-radius:** 4px - 8px
- **Box-shadow:** `0px 2px 15px rgba(0, 0, 0, 0.1)`
- **Box-shadow (servicos):** `0 0 29px 0 rgba(68, 88, 144, 0.12)`

### Espacamento
- **Section padding:** 60px 0
- **Header padding:** 22px 0 (normal) / 12px 0 (scrolled)

### Animacoes
- **AOS (Animate On Scroll):** fade-up, fade-left, fade-right, zoom-in
- **Transicoes:** ease-in-out 0.3s - 0.5s
- **Keyframes:** up-down (hero), animate-loading (spinner)

---

## Icones
- **Bootstrap Icons** (bi-*)
- **Boxicons** (bx-*)
- **Remix Icons** (ri-*)

---

## Bibliotecas/Vendors Utilizados
1. AOS - Animate On Scroll
2. Bootstrap 5
3. Bootstrap Icons
4. Boxicons
5. GLightbox
6. Remix Icons
7. Swiper
8. PureCounter
9. Isotope Layout
10. PHP Email Form Validator

---

## Breakpoints Responsivos
| Breakpoint | Largura |
|------------|---------|
| Extra Large | > 1366px |
| Large | > 1024px |
| Medium | > 991px |
| Small | > 768px |
| Extra Small | > 667px |
| Mobile | > 575px |

---

## Resumo das Cores Mais Usadas

```css
:root {
  /* Cores Primarias */
  --primary: #3498db;
  --primary-hover: #4aa3df;
  --primary-dark: #2383c4;
  --primary-light: #e1f0fa;

  /* Cores de Texto */
  --text-primary: #444444;
  --text-dark: #222222;
  --text-light: #555555;
  --text-muted: #888888;

  /* Cores de Fundo */
  --bg-white: #ffffff;
  --bg-light: #f7fbfe;
  --bg-clients: #f3f9fd;
  --bg-gray: #f6f6f6;

  /* Cores de Estado */
  --success: #18d26e;
  --error: #ed3c0d;
}
```
