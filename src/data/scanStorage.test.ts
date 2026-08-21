const mockResize = jest.fn().mockReturnThis();
const mockRenderAsync = jest.fn().mockResolvedValue({
  saveAsync: jest.fn().mockResolvedValue({ uri: 'file:///cache/resized.jpg' }),
});
const mockManipulate = jest
  .fn()
  .mockReturnValue({ resize: mockResize, renderAsync: mockRenderAsync });

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: (...args: unknown[]) => mockManipulate(...args) },
  SaveFormat: { JPEG: 'jpeg' },
}));

const mockCopy = jest.fn().mockResolvedValue(undefined);
const mockMove = jest.fn().mockResolvedValue(undefined);
const mockCreate = jest.fn();
let mockDirectoryExists = false;

jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///document' },
  Directory: class {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.join('/');
    }
    get exists() {
      return mockDirectoryExists;
    }
    create(...args: unknown[]) {
      mockCreate(...args);
    }
  },
  File: class {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts
        .map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri))
        .join('/');
    }
    copy(destination: { uri: string }) {
      return mockCopy(destination);
    }
    move(destination: { uri: string }) {
      return mockMove(destination);
    }
  },
}));

import { savePhotoFile } from './scanStorage';

describe('savePhotoFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDirectoryExists = false;
  });

  it('resizes the image to the maximum allowed dimension', async () => {
    await savePhotoFile('file:///cache/original.jpg');

    expect(mockManipulate).toHaveBeenCalledWith('file:///cache/original.jpg');
    expect(mockResize).toHaveBeenCalledWith({ width: 1600 });
  });

  it('creates the scans directory if it does not exist', async () => {
    mockDirectoryExists = false;

    await savePhotoFile('file:///cache/original.jpg');

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ intermediates: true }));
  });

  it('does not recreate the scans directory if it already exists', async () => {
    mockDirectoryExists = true;

    await savePhotoFile('file:///cache/original.jpg');

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('moves the resized image into the permanent scans directory and returns its URI', async () => {
    const finalUri = await savePhotoFile('file:///cache/original.jpg');

    expect(mockMove).toHaveBeenCalled();
    expect(finalUri).toContain('file:///document/scans/scan_');
  });

  it('saves into a different subdirectory with a matching file prefix when provided', async () => {
    const finalUri = await savePhotoFile(
      'file:///cache/original.jpg',
      'contributions',
      'contribution',
    );

    expect(finalUri).toContain('file:///document/contributions/contribution_');
  });
});

describe('savePhotoFile disk writes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDirectoryExists = true;
  });

  it('moves the rendered file instead of copying it, leaving one write', async () => {
    await savePhotoFile('file:///cache/original.jpg');

    expect(mockMove).toHaveBeenCalledTimes(1);
    expect(mockCopy).not.toHaveBeenCalled();
  });
});
