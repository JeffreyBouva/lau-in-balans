// Ambient Expo-types voor een schone checkout. Expo genereert normaal een gitignored
// `expo-env.d.ts`, maar pas bij `expo start` — dus `npm run typecheck` op een verse clone
// zou zonder dit falen op de `*.css`-imports uit de template. Bewust hier (niet als
// `expo-env.d.ts`, want die naam staat in .gitignore). Veilig te behouden: TS dedupliceert
// deze identieke reference wanneer Expo later zijn eigen bestand genereert.
/// <reference types="expo/types" />
