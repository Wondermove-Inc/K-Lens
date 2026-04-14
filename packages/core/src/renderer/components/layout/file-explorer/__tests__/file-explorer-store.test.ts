/**
 * 🎯 목적: FileExplorerStore 단위 테스트
 * 📝 테스트 범위:
 *   - openFolder 액션
 *   - closeFolder 액션
 *   - toggleDirectory 액션 (지연 로드)
 *   - selectEntry 액션
 *   - 에러 케이스
 * @module file-explorer/__tests__/file-explorer-store.test
 */

import { FileEntry, FileExplorerStore } from "../file-explorer-store";

// Mock IPC
const mockIpcInvoke = jest.fn();
jest.mock("electron", () => ({
  ipcRenderer: {
    invoke: (...args: unknown[]) => mockIpcInvoke(...args),
  },
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe("FileExplorerStore", () => {
  let store: FileExplorerStore;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new FileExplorerStore(mockLogger as any);
  });

  describe("초기 상태", () => {
    it("should have correct initial state", () => {
      // Assert
      expect(store.rootPath).toBeNull();
      expect(store.rootEntries).toEqual([]);
      expect(store.selectedPath).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  describe("openFolder", () => {
    const mockEntries: FileEntry[] = [
      { name: "src", path: "/test/src", isDirectory: true },
      { name: "package.json", path: "/test/package.json", isDirectory: false },
    ];

    it("should set rootPath and load entries on success", async () => {
      // Arrange
      mockIpcInvoke.mockResolvedValueOnce(mockEntries);

      // Act
      await store.openFolder("/test");

      // Assert
      expect(store.rootPath).toBe("/test");
      expect(store.rootEntries).toEqual(expect.arrayContaining(mockEntries.map((e) => expect.objectContaining(e))));
      expect(store.isLoading).toBe(false);
      expect(mockIpcInvoke).toHaveBeenCalledWith("fs:readDir", "/test");
    });

    it("should set isLoading to true while loading", async () => {
      // Arrange
      let resolvePromise: (value: FileEntry[]) => void;
      const promise = new Promise<FileEntry[]>((resolve) => {
        resolvePromise = resolve;
      });
      mockIpcInvoke.mockReturnValueOnce(promise);

      // Act
      const openPromise = store.openFolder("/test");

      // Assert - during loading
      expect(store.isLoading).toBe(true);

      // Resolve
      resolvePromise!(mockEntries);
      await openPromise;

      // Assert - after loading
      expect(store.isLoading).toBe(false);
    });

    it("should set error on failure", async () => {
      // Arrange
      const error = new Error("Permission denied");
      mockIpcInvoke.mockRejectedValueOnce(error);

      // Act
      await store.openFolder("/test");

      // Assert
      expect(store.error).toBe("Permission denied");
      expect(store.isLoading).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should save path to localStorage", async () => {
      // Arrange
      mockIpcInvoke.mockResolvedValueOnce(mockEntries);
      const setItemSpy = jest.spyOn(Storage.prototype, "setItem");

      // Act
      await store.openFolder("/test");

      // Assert
      expect(setItemSpy).toHaveBeenCalledWith("file-explorer-last-path", "/test");
      setItemSpy.mockRestore();
    });
  });

  describe("closeFolder", () => {
    it("should reset state when closing folder", async () => {
      // Arrange
      mockIpcInvoke.mockResolvedValueOnce([]);
      await store.openFolder("/test");

      // Act
      store.closeFolder();

      // Assert
      expect(store.rootPath).toBeNull();
      expect(store.rootEntries).toEqual([]);
      expect(store.selectedPath).toBeNull();
    });

    it("should remove path from localStorage", () => {
      // Arrange
      const removeItemSpy = jest.spyOn(Storage.prototype, "removeItem");

      // Act
      store.closeFolder();

      // Assert
      expect(removeItemSpy).toHaveBeenCalledWith("file-explorer-last-path");
      removeItemSpy.mockRestore();
    });
  });

  describe("toggleDirectory", () => {
    const mockSubEntries: FileEntry[] = [{ name: "index.ts", path: "/test/src/index.ts", isDirectory: false }];

    it("should expand directory and load children", async () => {
      // Arrange
      const dirEntry: FileEntry = {
        name: "src",
        path: "/test/src",
        isDirectory: true,
        isExpanded: false,
      };
      mockIpcInvoke.mockResolvedValueOnce(mockSubEntries);

      // Act
      await store.toggleDirectory(dirEntry);

      // Assert
      expect(dirEntry.isExpanded).toBe(true);
      expect(dirEntry.children).toEqual(expect.arrayContaining(mockSubEntries.map((e) => expect.objectContaining(e))));
      expect(mockIpcInvoke).toHaveBeenCalledWith("fs:readDir", "/test/src");
    });

    it("should collapse directory if already expanded", async () => {
      // Arrange
      const dirEntry: FileEntry = {
        name: "src",
        path: "/test/src",
        isDirectory: true,
        isExpanded: true,
        children: mockSubEntries,
      };

      // Act
      await store.toggleDirectory(dirEntry);

      // Assert
      expect(dirEntry.isExpanded).toBe(false);
      expect(mockIpcInvoke).not.toHaveBeenCalled();
    });

    it("should not toggle file entries", async () => {
      // Arrange
      const fileEntry: FileEntry = {
        name: "index.ts",
        path: "/test/index.ts",
        isDirectory: false,
      };

      // Act
      await store.toggleDirectory(fileEntry);

      // Assert
      expect(mockIpcInvoke).not.toHaveBeenCalled();
    });
  });

  describe("selectEntry", () => {
    it("should set selectedPath", () => {
      // Act
      store.selectEntry("/test/file.ts");

      // Assert
      expect(store.selectedPath).toBe("/test/file.ts");
    });

    it("should clear selection when passing null", () => {
      // Arrange
      store.selectEntry("/test/file.ts");

      // Act
      store.selectEntry(null);

      // Assert
      expect(store.selectedPath).toBeNull();
    });
  });

  describe("restoreLastPath", () => {
    it("should restore path from localStorage if exists", async () => {
      // Arrange
      const mockEntries: FileEntry[] = [];
      mockIpcInvoke
        .mockResolvedValueOnce(true) // fs:exists
        .mockResolvedValueOnce(mockEntries); // fs:readDir
      jest.spyOn(Storage.prototype, "getItem").mockReturnValueOnce("/saved/path");

      // Act
      await store.restoreLastPath();

      // Assert
      expect(store.rootPath).toBe("/saved/path");
    });

    it("should not restore if path does not exist", async () => {
      // Arrange
      mockIpcInvoke.mockResolvedValueOnce(false); // fs:exists returns false
      jest.spyOn(Storage.prototype, "getItem").mockReturnValueOnce("/invalid/path");

      // Act
      await store.restoreLastPath();

      // Assert
      expect(store.rootPath).toBeNull();
    });

    it("should not restore if no saved path", async () => {
      // Arrange
      jest.spyOn(Storage.prototype, "getItem").mockReturnValueOnce(null);

      // Act
      await store.restoreLastPath();

      // Assert - saved path가 없으면 home path fallback을 시도할 수 있음
      expect(mockIpcInvoke).toHaveBeenCalledWith("fs:getHomePath");
    });
  });

  describe("computed properties", () => {
    it("should return hasOpenFolder as true when rootPath is set", async () => {
      // Arrange
      mockIpcInvoke.mockResolvedValueOnce([]);
      await store.openFolder("/test");

      // Assert
      expect(store.hasOpenFolder).toBe(true);
    });

    it("should return hasOpenFolder as false when rootPath is null", () => {
      // Assert
      expect(store.hasOpenFolder).toBe(false);
    });
  });

  describe("정렬 로직", () => {
    it("should sort directories before files", async () => {
      // Arrange
      const unsortedEntries: FileEntry[] = [
        { name: "zebra.txt", path: "/test/zebra.txt", isDirectory: false },
        { name: "alpha", path: "/test/alpha", isDirectory: true },
        { name: "beta.txt", path: "/test/beta.txt", isDirectory: false },
        { name: "gamma", path: "/test/gamma", isDirectory: true },
      ];
      mockIpcInvoke.mockResolvedValueOnce(unsortedEntries);

      // Act
      await store.openFolder("/test");

      // Assert - 디렉토리가 먼저
      expect(store.rootEntries[0].isDirectory).toBe(true);
      expect(store.rootEntries[1].isDirectory).toBe(true);
      expect(store.rootEntries[2].isDirectory).toBe(false);
      expect(store.rootEntries[3].isDirectory).toBe(false);
    });

    it("should sort alphabetically within same type", async () => {
      // Arrange
      const unsortedEntries: FileEntry[] = [
        { name: "zebra.txt", path: "/test/zebra.txt", isDirectory: false },
        { name: "alpha.txt", path: "/test/alpha.txt", isDirectory: false },
      ];
      mockIpcInvoke.mockResolvedValueOnce(unsortedEntries);

      // Act
      await store.openFolder("/test");

      // Assert - 알파벳순
      expect(store.rootEntries[0].name).toBe("alpha.txt");
      expect(store.rootEntries[1].name).toBe("zebra.txt");
    });

    it("should sort directories alphabetically", async () => {
      // Arrange
      const unsortedEntries: FileEntry[] = [
        { name: "zfolder", path: "/test/zfolder", isDirectory: true },
        { name: "afolder", path: "/test/afolder", isDirectory: true },
      ];
      mockIpcInvoke.mockResolvedValueOnce(unsortedEntries);

      // Act
      await store.openFolder("/test");

      // Assert
      expect(store.rootEntries[0].name).toBe("afolder");
      expect(store.rootEntries[1].name).toBe("zfolder");
    });
  });

  describe("toggleHiddenFiles", () => {
    it("should toggle showHiddenFiles state", () => {
      // Assert initial
      expect(store.showHiddenFiles).toBe(false);

      // Act
      store.toggleHiddenFiles();

      // Assert
      expect(store.showHiddenFiles).toBe(true);

      // Act again
      store.toggleHiddenFiles();

      // Assert
      expect(store.showHiddenFiles).toBe(false);
    });

    it("should reload folder when toggling hidden files", async () => {
      // Arrange
      mockIpcInvoke.mockResolvedValue([]);
      await store.openFolder("/test");
      mockIpcInvoke.mockClear();

      // Act
      store.toggleHiddenFiles();

      // Assert - openFolder가 다시 호출됨
      expect(mockIpcInvoke).toHaveBeenCalledWith("fs:readDir", "/test");
    });
  });

  describe("refresh", () => {
    it("should reload current folder", async () => {
      // Arrange
      mockIpcInvoke.mockResolvedValueOnce([]);
      await store.openFolder("/test");
      mockIpcInvoke.mockClear();

      const newEntries: FileEntry[] = [{ name: "new.txt", path: "/test/new.txt", isDirectory: false }];
      mockIpcInvoke.mockResolvedValueOnce(newEntries);

      // Act
      await store.refresh();

      // Assert
      expect(mockIpcInvoke).toHaveBeenCalledWith("fs:readDir", "/test");
      expect(store.rootEntries).toEqual(expect.arrayContaining(newEntries.map((e) => expect.objectContaining(e))));
    });

    it("should do nothing if no folder is open", async () => {
      // Act
      await store.refresh();

      // Assert
      expect(mockIpcInvoke).not.toHaveBeenCalled();
    });
  });
});
