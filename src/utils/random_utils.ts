//#region Randomizer

export type Randomizer = (bound: number) => number

export const standardRandomizer: Randomizer = n => Math.floor(Math.random() * n)

//#endregion

//#region Shuffler

export type Shuffler<T> = (cards: Readonly<T[]>) => T[]

export function standardShuffler<T>(cards: Readonly<T[]>): T[]
{
  const shuffled = [...cards]
  for (let i = 0; i < shuffled.length - 1; i++)
  {
    const j = Math.floor(Math.random() * (shuffled.length - i) + i)
    const temp = shuffled[j]
    shuffled[j] = shuffled[i]
    shuffled[i] = temp
  }
  return shuffled
}

//#endregion
