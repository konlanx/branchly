export const sequentially = <ItemType>(
  items: readonly ItemType[],
  task: (item: ItemType) => Promise<void>,
): Promise<void> =>
  items.reduce<Promise<void>>((previousTasks, item) => previousTasks.then(() => task(item)), Promise.resolve());
