export const getRandomBytes = (size: number): Uint8Array => {
  const array = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    array[i] = (Math.random() * 256) | 0;
  }
  return array;
};
