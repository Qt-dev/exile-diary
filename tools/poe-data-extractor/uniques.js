import Uniques from './data/tables/English/UniqueStashLayout.json' with { type: "json" };
import ItemVisualIdentity from './data/tables/English/ItemVisualIdentity.json' with { type: "json" };
import Words from './data/tables/English/Words.json' with { type: "json" };
import fs from 'fs/promises';

export default async () => {
  const output = {
    byIconPath: {}
  };
  Uniques.map((unique) => {
    const visualIdentity = ItemVisualIdentity.find(
      (item) => item._index === unique.ItemVisualIdentityKey
    );
    const imagePath = visualIdentity.DDSFile.replace('Art/2DItems/', '').replace('.dds', '');
    const words = Words.find((item) => item._index === unique.WordsKey);
    return { imagePath, name: words.Text };
  })
  .filter((unique) => !unique.name.includes('Replica'))
  .sort((a, b) => a.name.localeCompare(b.name))
  .forEach((unique) => {
    output.byIconPath[unique.imagePath] = unique.name;
  });

  await fs.writeFile('output/uniques.json', JSON.stringify(output, null, 2));
  console.log('Uniques generated successfully.');
}