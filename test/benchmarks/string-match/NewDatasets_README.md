# New Test Datasets for Benchmark

This document describes the newly created test datasets for the StringParser benchmark.

## Overview

The new datasets replace the previous corrected datasets with freshly generated ones that:

- Use all valid mods from `src/helpers/data/mapMods.json`
- Include realistic OCR-style corruptions
- Meet the specified requirements for corruption distribution and characteristics

## Dataset Specifications

### Sizes

- **Small Dataset 1**: 10 entries
- **Small Dataset 2**: 10 entries
- **Small Dataset 3**: 10 entries
- **Medium Dataset 1**: 20 entries
- **Medium Dataset 2**: 30 entries
- **Large Dataset**: 40 entries

**Total**: 120 unique test cases

### Corruption Characteristics

Each dataset meets the following requirements:

- **Minimum 30% corruption rate**: At least 30% of strings contain corruptions
- **First character corruption**: At least 10% of strings have corrupted first characters
- **Corruption extent**: Maximum 20% of each string's length is affected by corruption

### OCR-Style Corruption Types

The generator applies three types of realistic OCR errors:

1. **Character Replacements**: Common OCR misreads

   - `A` → `4`, `@`, `Á`
   - `I` → `1`, `l`, `!`
   - `O` → `0`, `Q`, `C`
   - `S` → `5`, `$`, `Z`
   - And many more...

2. **Character Additions**: OCR artifacts

   - Random insertion of characters like `·`, `¨`, `¿`, `¡`, `«`, `»`

3. **Character Deletions**: OCR misses
   - Random character removal

### Actual Corruption Rates

The generated datasets achieved:

- Small Dataset 1: 50.0% corrupted (1 first-char)
- Small Dataset 2: 50.0% corrupted (1 first-char)
- Small Dataset 3: 40.0% corrupted (1 first-char)
- Medium Dataset 1: 60.0% corrupted (2 first-char)
- Medium Dataset 2: 60.0% corrupted (3 first-char)
- Large Dataset: 65.0% corrupted (4 first-char)

## Usage

The datasets are exposed through the `NEW_TEST_DATASETS` export in `NewTestDatasets.ts`:

```typescript
import { NEW_TEST_DATASETS } from './NewTestDatasets';

// Access individual datasets
const smallDataset1 = NEW_TEST_DATASETS.small1;
const mediumDataset1 = NEW_TEST_DATASETS.medium1;
const largeDataset = NEW_TEST_DATASETS.large1;
```

## Integration with ParserBenchmark

The datasets are already integrated with `ParserBenchmark.ts` and work with the existing `getTestData()` function without requiring any changes to the benchmark calls:

```typescript
'Small Dataset 1': HARDCODED_TEST_DATASETS.small1,
'Small Dataset 2': HARDCODED_TEST_DATASETS.small2,
'Small Dataset 3': HARDCODED_TEST_DATASETS.small3,
'Medium Dataset 1': HARDCODED_TEST_DATASETS.medium1,
'Medium Dataset 2': HARDCODED_TEST_DATASETS.medium2,
'Large Dataset': HARDCODED_TEST_DATASETS.large1
```

## Performance Results

The new datasets show excellent performance with the BK-Tree implementation:

- **BK-Tree**: 100% accuracy across all datasets
- **JavaScript/Fastest-Levenshtein**: ~30-60% accuracy
- **WASM**: ~30-60% accuracy

## Data Structure

Each test case follows the standard format:

```typescript
interface TestData {
  original: string; // The original clean mod from mapMods.json
  corrupted: string; // The corrupted version with OCR-style errors
  expected: string; // The expected output (same as original)
}
```

## Generation Script

The datasets were generated using `GenerateNewDatasets.ts`, which:

- Loads all 1,790 mods from `mapMods.json`
- Applies realistic OCR corruptions
- Ensures proper distribution of corruption types
- Validates all expected outputs against the official mod list

The generator ensures no duplicate mods are used across datasets and maintains the quality standards required for consistent benchmarking.
