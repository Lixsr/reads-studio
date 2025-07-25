"use client";

import { useState, useEffect } from "react";
import { DocumentUploader } from "@/components/document-uploader";
import { PagesList } from "@/components/pages-list";
import { SummarizedPagesList } from "@/components/summarized-pages-list";
import { PageViewer } from "@/components/page-viewer";
import { SummaryViewer } from "@/components/summary-viewer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, AlignLeft } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import {
  updateBookContent,
  summarizeText as apiSummarizeText,
  type PageSummary,
} from "@/lib/api-client";
import { getRead } from "@/src/graphql/queries";
import { client } from "@/lib/amplify";
import { deleteSlidesByBook, uploadSlides } from "@/lib/actions/book.actions";
import { getBookContent } from "@/lib/actions/slide.actions";
import { uploadData } from "aws-amplify/storage";
import { delay } from "@/lib/utils";
interface DocumentSplitterProps {
  bookId?: string;
}

export function DocumentSplitter({ bookId }: DocumentSplitterProps) {
  const [pages, setPages] = useState<string[]>([]);
  const [pageSummaries, setPageSummaries] = useState<PageSummary[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [fileType, setFileType] = useState<"word" | "pdf" | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"pages" | "summaries">("pages");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const [bookInfo, setBookInfo] = useState<{
    title: string;
    author: string;
    description: string;
    coverImageUrl?: string;
    isOwnedByUser: boolean;
    id?: string;
  }>({
    title: "",
    author: "",
    description: "",
    coverImageUrl: undefined,
    isOwnedByUser: false,
  });
  const [startedFromScratch, setStartedFromScratch] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  // Track which pages are currently being summarized
  const [summarizingPageIndices, setSummarizingPageIndices] = useState<
    Set<number>
  >(new Set());
  const [isSummarizingAll, setIsSummarizingAll] = useState(false);

  // Load book info and content from API on component mount
  useEffect(() => {
    if (!bookId) {
      setIsLoadingData(false);
      return;
    }

    // Load book info and content
    const loadBookData = async () => {
      setIsLoadingData(true);
      try {
        // Get book info
        const response = await client.graphql({
          query: getRead,
          variables: { id: bookId },
          authMode: "userPool",
        });

        if (response.data?.getRead) {
          const book = response.data.getRead;
          if (book) {
            setBookInfo({
              title:
                typeof book.title === "string" ? book.title : "Untitled Book",
              author:
                typeof book.AuthorName === "string"
                  ? book.AuthorName
                  : "Unknown Author",
              description:
                typeof book.description === "string" ? book.description : "",
              coverImageUrl: book.thumbnailUrl,
              isOwnedByUser: !!book.userId,
            });
            setFileName(
              typeof book.title === "string" ? book.title : "Untitled Book"
            );

            // To do: Handle slides data if exits
            // Get book content
            const content = await getBookContent(bookId);
            if (content) {
              // ToDo: handle title and imagePosition when they exist on DB
              const summaries: PageSummary[] = content.map((slide: any) => {
                return {
                  title: `Title ${slide.slideNumber}`,
                  content: slide.text,
                  imageUrl: slide.imageUrl || undefined,
                  imagePosition: "bottom",
                  isLoading: false,
                  isGeneratingImage: false,
                };
              });

              setPageSummaries(summaries); // Now it's an array
              setFileType("word");
              setSelectedPageIndex(0);
              setViewMode("summaries");

              toast.success("Loaded saved content", {
                description: `Loaded ${content.length} pages from "${
                  typeof book?.title === "string" ? book.title : "Untitled Book"
                }"`,
              });
            }
          }
        }
      } catch (e) {
        console.error("Error loading book data:", e);
        toast.error("Error loading book data", {
          description:
            "There was a problem loading your book data. Please try again.",
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    loadBookData();
  }, [bookId]);

  // Function to handle document processing and update state
  const handleDocumentProcessed = async (
    result: string[],
    name: string,
    type: "word" | "pdf"
  ) => {
    setPages(result);

    // Initialize summaries with the same content as pages
    const initialSummaries = result.map((page, index) => {
      // Extract text content from HTML for the initial summary
      const textContent = page.replace(/<[^>]*>/g, " ").trim();

      return {
        title: `Summary of Page ${index + 1}`,
        content: textContent.substring(0, 200) + "...",
        imageUrl: undefined,
        imagePosition: "bottom" as const, // Default position
        isLoading: false, // Not loading initially
        isGeneratingImage: false, // Not generating image initially
      };
    });

    setPageSummaries(initialSummaries);
    setFileName(name);
    setFileType(type);
    setSelectedPageIndex(0); // Select the first page by default
    setStartedFromScratch(false);

    // // Save the content to API
    // if (bookId) {
    //   await updateBookContent(bookId, {
    //     pages: result,
    //     summaries: initialSummaries,
    //   });
    // }

    toast.success("Document processed successfully", {
      description: `${result.length} pages extracted from ${name}`,
    });
  };

  // Function to handle starting from scratch
  const handleStartFromScratch = async () => {
    // Set up an empty state for starting from scratch
    setPages([]);

    // Initialize with one empty page
    const initialPage: PageSummary = {
      title: "New Page 1",
      content: "Add your summary content here...",
      imageUrl: undefined,
      imagePosition: "bottom",
      isGeneratingImage: false,
    };

    setPageSummaries([initialPage]);
    setFileName(bookInfo.title || "My Summaries");
    setFileType("word"); // Default type
    setSelectedPageIndex(0);
    setStartedFromScratch(true);
    setViewMode("summaries"); // Switch directly to summaries view

    toast.success("Started from scratch", {
      description: "You can now add pages and create your summaries.",
    });
  };

  const handlePageSelect = (index: number) => {
    const maxIndex =
      viewMode === "pages" ? pages.length - 1 : pageSummaries.length - 1;
    if (index >= 0 && index <= maxIndex) {
      setSelectedPageIndex(index);
    } else {
      console.warn(`Invalid page index: ${index}, max: ${maxIndex}`);
      // If invalid index, select the first page
      setSelectedPageIndex(0);
    }
  };

  // Update the handleSummaryUpdate function to ensure it updates the correct page
  const handleSummaryUpdate = async (summary: PageSummary) => {
    if (selectedPageIndex < 0 || selectedPageIndex >= pageSummaries.length) {
      console.error("Invalid page index for update:", selectedPageIndex);
      return;
    }

    setIsSaving(true);
    try {
      // Make sure we're working with valid string data
      const sanitizedSummary: PageSummary = {
        title:
          typeof summary.title === "string"
            ? summary.title
            : "Untitled Summary",
        content: typeof summary.content === "string" ? summary.content : "",
        imageUrl: summary.imageUrl,
        imagePosition: summary.imagePosition || "bottom",
        isLoading: !!summary.isLoading,
        isGeneratingImage: !!summary.isGeneratingImage,
      };

      // Create a new array to avoid reference issues
      const newSummaries = [...pageSummaries];
      newSummaries[selectedPageIndex] = sanitizedSummary;

      // Update state first
      setPageSummaries(newSummaries);

      // Then save to API with proper error handling
      if (bookId) {
        try {
          await updateBookContent(bookId, {
            pages,
            summaries: newSummaries,
          });
        } catch (error) {
          console.error("Error saving to API:", error);
          toast.error("Failed to save changes", {
            description:
              "Your changes were applied locally but couldn't be saved to the server.",
          });
        }
      }
    } catch (error) {
      console.error("Error updating summary:", error);
      toast.error("Failed to save summary", {
        description:
          "There was an error saving your changes. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Fix the handleImageGenerationStart and handleImageGenerationComplete functions to be more robust
  // Handle image generation start
  const handleImageGenerationStart = (pageIndex: number) => {
    if (pageIndex < 0 || pageIndex >= pageSummaries.length) {
      console.error("Invalid page index for image generation:", pageIndex);
      return;
    }

    setPageSummaries((prevSummaries) => {
      const newSummaries = [...prevSummaries];
      newSummaries[pageIndex] = {
        ...newSummaries[pageIndex],
        isGeneratingImage: true,
      };

      return newSummaries;
    });
  };

  // Handle image generation complete
  // Update handleImageGenerationComplete to ensure it updates the correct page
  const handleImageGenerationComplete = async (
    pageIndex: number,
    imageUrl: string
  ) => {
    if (pageIndex < 0 || pageIndex >= pageSummaries.length) {
      console.error(
        "Invalid page index for image generation completion:",
        pageIndex
      );
      return;
    }

    try {
      // Create a new array to avoid reference issues
      const newSummaries = [...pageSummaries];

      // Update only the specified page index
      newSummaries[pageIndex] = {
        ...newSummaries[pageIndex],
        imageUrl: imageUrl,
        isGeneratingImage: false,
      };

      // Update state first
      setPageSummaries(newSummaries);

      // If the specified page is the currently selected page, update the selection
      if (pageIndex === selectedPageIndex) {
        setSelectedPageIndex(pageIndex);
      }

      // Save changes to API with proper error handling
      if (bookId) {
        try {
          await updateBookContent(bookId, {
            pages,
            summaries: newSummaries,
          });
        } catch (error) {
          console.error(
            `Error saving image generation for page ${pageIndex + 1}:`,
            error
          );
          toast.error("Failed to save generated image", {
            description:
              "The image was generated but couldn't be saved to the server.",
          });
        }
      }
    } catch (error) {
      console.error(
        `Error completing image generation for page ${pageIndex + 1}:`,
        error
      );

      // Reset the generating state even if there was an error
      setPageSummaries((prevSummaries) => {
        const newSummaries = [...prevSummaries];
        newSummaries[pageIndex] = {
          ...newSummaries[pageIndex],
          isGeneratingImage: false,
        };
        return newSummaries;
      });

      toast.error("Error processing generated image", {
        description: "There was a problem processing the generated image.",
      });
    }
  };

  const handleReorderPages = async (reorderedPages: PageSummary[]) => {
    // Validate the reordered pages array
    if (
      !Array.isArray(reorderedPages) ||
      reorderedPages.length !== pageSummaries.length
    ) {
      console.error("Invalid reordered pages array:", reorderedPages);
      return;
    }

    setIsSaving(true);
    try {
      // Validate each page summary
      const validatedPages = reorderedPages.map((page) => ({
        title: typeof page.title === "string" ? page.title : "Untitled Summary",
        content: typeof page.content === "string" ? page.content : "",
        imageUrl: page.imageUrl,
        imagePosition: page.imagePosition || "bottom",
        isLoading: !!page.isLoading,
        isGeneratingImage: !!page.isGeneratingImage,
      }));

      // Update state first
      setPageSummaries(validatedPages);

      // Save reordered pages to API with proper error handling
      if (bookId) {
        try {
          await updateBookContent(bookId, {
            pages,
            summaries: validatedPages,
          });

          toast.success("Pages reordered successfully", {
            description: "The new page order has been saved.",
          });
        } catch (error) {
          console.error("Error saving reordered pages to API:", error);
          toast.error("Failed to save new page order", {
            description:
              "Your changes were applied locally but couldn't be saved to the server.",
          });
        }
      }
    } catch (error) {
      console.error("Error reordering pages:", error);
      toast.error("Failed to reorder pages", {
        description:
          "There was an error saving the new page order. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Improve the handleAddNewPage function with better error handling, validation, and options
  const handleAddNewPage = async (options?: {
    duplicate?: boolean;
    insertAfterIndex?: number;
    template?: "blank" | "detailed";
  }) => {
    try {
      // Validate maximum number of pages (optional limit)
      const MAX_PAGES = 100; // Example limit
      if (pageSummaries.length >= MAX_PAGES) {
        toast.error("Maximum page limit reached", {
          description: `You cannot add more than ${MAX_PAGES} pages.`,
        });
        return;
      }

      setIsSaving(true);

      // Determine where to insert the new page
      const insertAtIndex =
        options?.insertAfterIndex !== undefined
          ? options.insertAfterIndex + 1
          : pageSummaries.length;

      // Create the new page content
      let newPage: PageSummary;

      if (
        options?.duplicate &&
        insertAtIndex > 0 &&
        insertAtIndex <= pageSummaries.length
      ) {
        // Duplicate the selected page
        const sourcePage =
          pageSummaries[options.insertAfterIndex || selectedPageIndex];
        newPage = {
          title: `${sourcePage.title} (Copy)`,
          content: sourcePage.content,
          imageUrl: sourcePage.imageUrl,
          imagePosition: sourcePage.imagePosition,
          isGeneratingImage: false,
        };
      } else {
        // Create a new page with template
        if (options?.template === "detailed") {
          newPage = {
            title: `New Page ${pageSummaries.length + 1}`,
            content:
              "# Summary Heading\n\nAdd your detailed summary here...\n\n## Key Points\n\n- First point\n- Second point\n- Third point\n\n## Conclusion\n\nSummarize your main points here.",
            imageUrl: undefined,
            imagePosition: "bottom",
            isGeneratingImage: false,
          };
        } else {
          // Default blank template
          newPage = {
            title: `New Page ${pageSummaries.length + 1}`,
            content: "Add your summary content here...",
            imageUrl: undefined,
            imagePosition: "bottom",
            isGeneratingImage: false,
          };
        }
      }

      // Insert the new page at the specified position
      const newSummaries = [...pageSummaries];
      newSummaries.splice(insertAtIndex, 0, newPage);
      setPageSummaries(newSummaries);

      // Select the newly added page
      setSelectedPageIndex(insertAtIndex);

      // Save updated summaries to API with proper error handling
      if (bookId) {
        try {
          await updateBookContent(bookId, {
            pages,
            summaries: newSummaries,
          });
        } catch (error) {
          console.error("Failed to save new page to API:", error);
          toast.error("Error saving page", {
            description:
              "Your new page was created but couldn't be saved to the server. Please try again later.",
          });
          // Continue execution since the page was added to the UI
        }
      }

      toast.success("New page added", {
        description: "A new page has been added to your summaries.",
      });
    } catch (error) {
      console.error("Error adding new page:", error);
      toast.error("Failed to add new page", {
        description: "There was an error adding a new page. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Add a new function to duplicate the current page
  const handleDuplicatePage = async () => {
    if (selectedPageIndex < 0 || selectedPageIndex >= pageSummaries.length) {
      toast.error("Cannot duplicate page", {
        description: "No valid page is selected to duplicate.",
      });
      return;
    }

    await handleAddNewPage({
      duplicate: true,
      insertAfterIndex: selectedPageIndex,
    });
  };

  const handleDeletePage = async (index: number) => {
    if (index >= 0 && index < pageSummaries.length) {
      setIsSaving(true);
      try {
        const newSummaries = [...pageSummaries];
        newSummaries.splice(index, 1);

        // Update state first
        setPageSummaries(newSummaries);

        // Adjust selected page index if needed
        if (selectedPageIndex >= newSummaries.length) {
          setSelectedPageIndex(Math.max(0, newSummaries.length - 1));
        } else if (selectedPageIndex === index) {
          setSelectedPageIndex(Math.max(0, index - 1));
        }

        // Save updated summaries to API with proper error handling
        if (bookId) {
          try {
            await updateBookContent(bookId, {
              pages,
              summaries: newSummaries,
            });

            toast.success("Page deleted", {
              description: `Page ${index + 1} has been removed.`,
            });
          } catch (error) {
            console.error("Error saving after page deletion:", error);
            toast.error("Failed to save after deletion", {
              description:
                "The page was removed locally but the changes couldn't be saved to the server.",
            });
          }
        }
      } catch (error) {
        console.error("Error deleting page:", error);
        toast.error("Failed to delete page", {
          description:
            "There was an error deleting the page. Please try again.",
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Function to generate a summary for the current page
  const handleGenerateSummary = (pageIndex: number) => {
    if (pageIndex < 0 || pageIndex >= pages.length) return;

    // Create a new promise to allow async handling
    return new Promise<void>(async (resolve, reject) => {
      try {
        // Add this page index to the set of summarizing pages
        setSummarizingPageIndices((prev) => {
          const newSet = new Set(prev);
          newSet.add(pageIndex);
          return newSet;
        });

        // Extract text content from HTML
        const pageContent = pages[pageIndex].replace(/<[^>]*>/g, " ").trim();

        // Call the summarizeText function from the API client
        const result = await apiSummarizeText(pageContent);

        // Validate the result data and provide fallbacks
        const validatedTitle =
          typeof result.imageTitle === "string"
            ? result.imageTitle
            : `Summary ${pageIndex + 1}`;
        const validatedSummary =
          typeof result.summary === "string" ? result.summary : "";

        // Create a new array to ensure React detects the state change
        setPageSummaries((prevSummaries) => {
          const updatedSummaries = [...prevSummaries];
          updatedSummaries[pageIndex] = {
            ...updatedSummaries[pageIndex],
            title: validatedTitle,
            content: validatedSummary,
            isLoading: false, // Explicitly set loading to false
          };
          return updatedSummaries;
        });

        // Save updated summaries to API
        if (bookId) {
          try {
            await updateBookContent(bookId, {
              pages,
              summaries: pageSummaries.map((summary, idx) =>
                idx === pageIndex
                  ? {
                      ...summary,
                      title: validatedTitle,
                      content: validatedSummary,
                      isLoading: false,
                    }
                  : summary
              ),
            });
          } catch (error) {
            console.error("Error saving to API:", error);
          }
        }

        toast.success("Summary generated", {
          description: `Summary for page ${pageIndex + 1} has been created.`,
        });

        // Remove this page index from the set of summarizing pages
        setSummarizingPageIndices((prev) => {
          const newSet = new Set(prev);
          newSet.delete(pageIndex);
          return newSet;
        });

        resolve();
      } catch (error) {
        console.error("Error generating summary:", error);

        // Remove this page index from the set of summarizing pages
        setSummarizingPageIndices((prev) => {
          const newSet = new Set(prev);
          newSet.delete(pageIndex);
          return newSet;
        });

        toast.error("Failed to generate summary", {
          description:
            "There was an error generating the summary. Please try again.",
        });
        reject(error);
      }
    });
  };

  // Function to summarize all pages
  const handleSummarizeAllPages = async () => {
    if (pages.length === 0) {
      toast.error("No pages to summarize", {
        description: "Please upload a document first.",
      });
      return;
    }

    setIsSummarizingAll(true);
    toast.info(`Summarizing ${pages.length} pages`, {
      description: "This may take a moment...",
    });

    let completedCount = 0;
    let failedCount = 0;

    // Process pages in batches to avoid overwhelming the API
    const batchSize = 3;
    for (let i = 0; i < pages.length; i += batchSize) {
      const batch = Array.from(
        { length: Math.min(batchSize, pages.length - i) },
        (_, j) => i + j
      );

      // Add all pages in this batch to the summarizing set
      setSummarizingPageIndices((prev) => {
        const newSet = new Set(prev);
        batch.forEach((index) => newSet.add(index));
        return newSet;
      });

      await Promise.all(
        batch.map(async (pageIndex) => {
          try {
            // Extract text content from HTML
            const pageContent = pages[pageIndex]
              .replace(/<[^>]*>/g, " ")
              .trim();

            // Call the summarizeText function from the API client
            const result = await apiSummarizeText(pageContent);

            // Validate the result data and provide fallbacks
            const validatedTitle =
              typeof result.imageTitle === "string"
                ? result.imageTitle
                : `Summary ${pageIndex + 1}`;
            const validatedSummary =
              typeof result.summary === "string" ? result.summary : "";

            // Update the state for this specific page
            setPageSummaries((prevSummaries) => {
              const updatedSummaries = [...prevSummaries];
              updatedSummaries[pageIndex] = {
                ...updatedSummaries[pageIndex],
                title: validatedTitle,
                content: validatedSummary,
                isLoading: false, // Explicitly set loading to false
              };
              return updatedSummaries;
            });

            completedCount++;

            // Show progress updates
            if (
              completedCount % 3 === 0 ||
              completedCount + failedCount === pages.length
            ) {
              toast.success(
                `Progress: ${completedCount}/${pages.length} pages summarized`,
                {
                  description: "Summarization is in progress...",
                  duration: 3000,
                }
              );
            }
          } catch (error) {
            console.error(`Error summarizing page ${pageIndex + 1}:`, error);
            failedCount++;
          } finally {
            // Remove this page from the summarizing set regardless of success/failure
            setSummarizingPageIndices((prev) => {
              const newSet = new Set(prev);
              newSet.delete(pageIndex);
              return newSet;
            });
          }
        })
      );
    }

    // Save all summaries to API
    if (bookId) {
      try {
        await updateBookContent(bookId, {
          pages,
          summaries: pageSummaries,
        });
      } catch (error) {
        console.error("Error saving summaries to API:", error);
      }
    }

    // Show final status
    if (failedCount > 0) {
      toast.error(`Summarization completed with errors`, {
        description: `Generated ${completedCount} summaries, ${failedCount} failed.`,
      });
    } else {
      toast.success("All pages summarized", {
        description: `Successfully summarized ${completedCount} pages.`,
      });
    }

    setIsSummarizingAll(false);

    // Switch to summaries view
    setViewMode("summaries");
  };

  // Add a new function to generate images for all pages
  const handleGenerateAllImages = async () => {
    const summariesToProcess = pageSummaries.filter(
      (summary) => !summary.imageUrl && !summary.isGeneratingImage
    );

    if (summariesToProcess.length === 0) {
      toast.info("No pages need images", {
        description:
          "All pages already have images or are currently generating.",
      });
      return;
    }

    toast.info(`Generating ${summariesToProcess.length} images`, {
      description: "This may take a moment...",
    });

    let completedCount = 0;
    let failedCount = 0;

    const newSummaries = [...pageSummaries];
    summariesToProcess.forEach((_, i) => {
      const pageIndex = pageSummaries.findIndex(
        (s, idx) =>
          !s.imageUrl &&
          !s.isGeneratingImage &&
          idx === pageSummaries.indexOf(summariesToProcess[i])
      );
      if (pageIndex !== -1) {
        newSummaries[pageIndex] = {
          ...newSummaries[pageIndex],
          isGeneratingImage: true,
        };
      }
    });
    setPageSummaries(newSummaries);

    if (bookId) {
      try {
        await updateBookContent(bookId, {
          pages,
          summaries: newSummaries,
        });
      } catch (error) {
        console.error("Error saving initial generation state:", error);
      }
    }

    const pagesToProcess = pageSummaries
      .map((summary, index) => ({ summary, index }))
      .filter(({ summary }) => !summary.imageUrl && !summary.isGeneratingImage);

    const batchSize = 3;
    for (let i = 0; i < pagesToProcess.length; i += batchSize) {
      const batch = pagesToProcess.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async ({ index }) => {
          try {
            // Generate a placeholder image
            const width = 600;
            const height = 400;
            const randomId = Math.floor(Math.random() * 1000);
            const imageUrl = `https://picsum.photos/seed/${randomId}/${width}/${height}`;

            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const file = new File([blob], "generated-image.jpg", {
              type: blob.type,
            });

            const uniqueId = uuidv4();
            const extension = file.name.split(".").pop();
            const key = `public/${uniqueId}.${extension}`;

            await uploadData({
              path: key,
              data: file,
              options: {
                onProgress: ({ transferredBytes, totalBytes = 100 }) => {
                  const percent = Math.round(
                    (transferredBytes / totalBytes) * 100
                  );
                  console.log(
                    `Image upload progress (page ${index + 1}): ${percent}%`
                  );
                },
              },
            });
            // Wait the image to be available on s3 storage
            await delay(500);
            setPageSummaries((prevSummaries) => {
              const updated = [...prevSummaries];
              updated[index] = {
                ...updated[index],
                imageUrl: key,
                isGeneratingImage: false,
              };

              // Persist to backend
              if (bookId) {
                updateBookContent(bookId, {
                  pages,
                  summaries: updated,
                }).catch((err) =>
                  console.error("Error saving updated summary:", err)
                );
              }

              return updated;
            });
            setPageSummaries((prevSummaries) => {
              const updated = [...prevSummaries];
              updated[index] = {
                ...updated[index],
                imageUrl: key,
                isGeneratingImage: false,
              };
              return updated;
            });

            completedCount++;

            if (
              completedCount % 3 === 0 ||
              completedCount + failedCount === summariesToProcess.length
            ) {
              toast.success(
                `Progress: ${completedCount}/${summariesToProcess.length} images generated`,
                {
                  description: "Image generation is in progress...",
                  duration: 3000,
                }
              );
            }
          } catch (error) {
            console.error(
              `Error generating/uploading image for page ${index + 1}:`,
              error
            );
            failedCount++;

            setPageSummaries((prevSummaries) => {
              const updated = [...prevSummaries];
              updated[index] = {
                ...updated[index],
                isGeneratingImage: false,
              };
              return updated;
            });
          }
        })
      );
    }

    if (failedCount > 0) {
      toast.error(`Image generation completed with errors`, {
        description: `Generated ${completedCount} images, ${failedCount} failed.`,
      });
    } else {
      toast.success("All images generated", {
        description: `Successfully generated ${completedCount} images.`,
      });
    }
  };

  // Function to handle uploading slides to the server
  const handleUploadSlides = async () => {
    if (!bookId) {
      toast.error("Book not found", {
        description: "Please ensure the book has been created first.",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Delete existing slides first
      const deleteResult = await deleteSlidesByBook(bookId);

      // disable it for now
      // if (!deleteResult.success) {
      //   throw new Error(`Deletion error: ${deleteResult.error}`);
      // }

      // Proceed to upload new slides
      const uploadResult = await uploadSlides(bookId, pageSummaries);

      if (uploadResult.success) {
        toast.success("Slides replaced successfully!", {
          description: `${uploadResult.uploadedCount} slides uploaded.`,
        });

        // move it to here after fixing the backend issue
        // router.push("/books");
      } else {
        throw new Error(`Upload error: ${uploadResult.error}`);
      }
    } catch (error: any) {
      console.log(
        "Failed to replace slides: Delete or upload actions issue",
        error
      );
      // toast.error("Failed to update slides", {
      //   description: error.message || "An unknown error occurred.",
      // });
    } finally {
      router.push("/books");
      setIsUploading(false);
    }
  };

  // Render the appropriate content based on the current state
  const renderContent = () => {
    // Show loading state
    if (isLoadingData) {
      return (
        <div className="md:col-span-3 flex items-center justify-center h-full">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 border-4 border-primary border-solid rounded-full animate-spin opacity-30"></div>
              <div className="absolute inset-2 border-4 border-primary border-dashed rounded-full animate-spin animate-reverse"></div>
              <div className="absolute inset-4 border-4 border-primary border-dotted rounded-full animate-spin animate-delay"></div>
            </div>
            <h3 className="mt-4 text-lg font-semibold">Loading Book Data</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Please wait while we load your book content...
            </p>
          </div>
        </div>
      );
    }

    // check if slides already exists
    const showDocumentUploader =
      pageSummaries.length === 0 && !startedFromScratch;
    return (
      <>
        {showDocumentUploader ? (
          <div className="md:col-span-3 border rounded-lg p-4 overflow-auto">
            <DocumentUploader
              onDocumentProcessed={handleDocumentProcessed}
              onProcessingStateChange={setIsProcessing}
              onError={(errorMsg) => {
                setError(errorMsg);
                if (errorMsg) {
                  toast.error("Error processing document", {
                    description: errorMsg,
                  });
                }
              }}
              onStartFromScratch={handleStartFromScratch}
            />
          </div>
        ) : (
          <>
            {/* Left sidebar - Pages list */}
            <div className="md:col-span-1 border rounded-lg p-4 overflow-auto">
              {!startedFromScratch ? (
                <Tabs
                  value={viewMode}
                  onValueChange={(value) => {
                    setViewMode(value as "pages" | "summaries");
                    // Reset selected page index when switching views to avoid out-of-bounds errors
                    setSelectedPageIndex(0);
                  }}
                  className="mb-4"
                >
                  <TabsList className="w-full">
                    {/* check if only summarized pages will be displayed */}
                    {pages.length > 0 && (
                      <TabsTrigger value="pages" className="flex-1">
                        <FileText className="mr-2 h-4 w-4" />
                        Pages
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="summaries" className="flex-1">
                      <AlignLeft className="mr-2 h-4 w-4" />
                      Summarized Pages
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : (
                <h3 className="text-lg font-medium mb-4">Summarized Pages</h3>
              )}
              {viewMode === "pages" && !startedFromScratch ? (
                <PagesList
                  pages={pages}
                  fileName={fileName}
                  fileType={fileType || "word"}
                  selectedPageIndex={selectedPageIndex}
                  onSelectPage={handlePageSelect}
                  onSummarizeAllPages={handleSummarizeAllPages}
                />
              ) : (
                <SummarizedPagesList
                  pageSummaries={pageSummaries}
                  fileName={fileName}
                  fileType={fileType || "word"}
                  selectedPageIndex={selectedPageIndex}
                  onSelectPage={handlePageSelect}
                  onReorderPages={handleReorderPages}
                  onAddNewPage={handleAddNewPage} // Direct call to handleAddNewPage without dialog
                  onDeletePage={handleDeletePage}
                  onGenerateAllImages={handleGenerateAllImages}
                  onUploadSlides={handleUploadSlides}
                  summarizingPageIndices={summarizingPageIndices}
                />
              )}
            </div>

            {/* Right content area - Page/Summary Viewer */}
            <div className="md:col-span-2 border rounded-lg p-4 overflow-auto">
              {viewMode === "pages" && !startedFromScratch ? (
                <PageViewer
                  page={pages[selectedPageIndex]}
                  pageIndex={selectedPageIndex}
                  fileName={fileName}
                  onGenerateSummary={handleGenerateSummary}
                  isSummarizing={summarizingPageIndices.has(selectedPageIndex)}
                />
              ) : pageSummaries.length > 0 ? (
                <SummaryViewer
                  pageSummary={pageSummaries[selectedPageIndex]}
                  pageIndex={selectedPageIndex}
                  bookInfo={bookInfo}
                  onUpdateSummary={handleSummaryUpdate}
                  onImageGenerationStart={handleImageGenerationStart}
                  onImageGenerationComplete={handleImageGenerationComplete}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <AlignLeft className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No pages yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Click the "Add New Page" button to create your first summary
                    page.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </>
    );
  };

  // Update the return statement to remove the dialog
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-120px)] min-h-[600px]">
      {renderContent()}
    </div>
  );
}
