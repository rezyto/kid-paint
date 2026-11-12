# Recon — PENUP (Samsung), parte "Colorir"

Âmbito: só o ciclo de colorir do PENUP (livros de colorir + ferramentas + guardar), adaptado a uma criança num tablet Android, a pintar com o dedo. A rede social, as contas, os live drawings e os desafios ficam de fora.

## Fontes
- Samsung — Common questions and usage tips for PENUP: https://www.samsung.com/us/support/answer/ANS10001378/
- Samsung — Digital coloring with PENUP: https://www.samsung.com/us/support/answer/ANS10001407/
- SamMobile — PENUP coloring books: https://www.sammobile.com/news/samsung-penup-week-spark-creativity-with-coloring-books/
- Resumo de avaliações (Google Play): https://grand-screen.com/apps/penup-drawing-sharing-sns/reviews/
- Queixas típicas de apps de colorir para crianças (paywalls, falta de "apagar tudo"): https://spark.mwm.ai/en/apps/coloring-book-kids-games/1475222650

## Ecrãs
| ID | ecrã | propósito | componentes | estados |
|---|---|---|---|---|
| S01 | Início | escolher o que pintar, continuar | cartão "continuar", mosaicos de categorias, galeria, pais | sem desenho em curso / com desenho em curso |
| S02 | Catálogo da categoria | escolher uma página | miniaturas, nível, scroll infinito | a carregar, cheio |
| S03 | Pintar | colorir | tela, ferramentas, paleta, tamanhos, desfazer/refazer, apagar tudo, guardar | vazio, em curso, zoom, confirmação de apagar |
| S04 | Os meus desenhos | rever e continuar desenhos | grelha, guardar no tablet, apagar | vazio, cheio, confirmação |
| S05 | Da minha foto | transformar uma foto numa página para pintar | escolher/tirar foto, detalhe, espessura | sem foto, a processar, pré-visualização, erro |
| S06 | Pais | definições | nível, sons, versão, atualizações | — |

## Fluxos
- F01 Pintar uma página nova: S01 → S02 → S03 (3 toques até pintar)
- F02 Continuar: abrir a app → S03 abre logo no desenho em que estava (0 toques)
- F03 Foto: S01 → S05 → escolher foto → "Pintar esta" → S03
- F04 Rever: S01 → S04 → tocar → S03
- Casos-limite: sair a meio do traço, fechar a app, atualização da app, tocar numa linha com o balde, dois dedos (zoom e não pintura)

## Modelo de dados (inferido, confiança média)
Drawing { id, title, kind (gen|photo), category, seed, level, line (PNG), paint (PNG), thumb, created, updated, done }

## Tamanho
M. As partes difíceis são as páginas infinitas (geradas por procedimento), o enchimento por regiões, a conversão de foto em desenho, guardar automaticamente e atualizar sem perder dados.

## Ângulo (o que torna esta versão melhor para uma criança)
O PENUP pede conta e login, mistura uma rede social pública e tem a interface pensada para adultos. Aqui não há conta nem internet obrigatória, não há anúncios nem compras, as páginas são infinitas e o nível cresce com a criança. Os botões são grandes, há "apagar tudo", e a app guarda sempre sozinha e reabre onde ela estava.
