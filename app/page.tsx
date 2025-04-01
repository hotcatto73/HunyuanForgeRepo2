'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Inter } from 'next/font/google';
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from '@clerk/nextjs';
import dynamic from 'next/dynamic';

const inter = Inter({ subsets: ['latin'] });

// Create a client-side only video component
const VideoBackground = dynamic(() => Promise.resolve(() => (
  <div className="fixed inset-0 w-full h-full z-0">
    <video
      autoPlay
      loop
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover"
      style={{ filter: 'brightness(0.4)' }}
    >
      <source src="/backgroundlive.mp4" type="video/mp4" />
    </video>
    <video
      autoPlay
      loop
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover"
      style={{ mixBlendMode: 'plus-lighter', opacity: 0.25 }}
    >
      <source src="/gradientoverlay.mp4" type="video/mp4" />
    </video>
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/30"></div>
  </div>
)), { ssr: false });

export default function Home() {
  const router = useRouter();
  const [showPopup, setShowPopup] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'completed'>('idle');
  const [uploadedFiles, setUploadedFiles] = useState<{
    name: string;
    size: number;
    progress: number;
    status: 'uploading' | 'completed' | 'error';
    speed: string;
    timeRemaining: string;
    file: File;
  }[]>([]);
  const [formData, setFormData] = useState({
    triggerWord: '',
    hfToken: '',
  });
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);
  const overlayVideoRef = useRef<HTMLVideoElement>(null);
  const { user } = useUser();

  // Handle video initialization after component mounts
  useEffect(() => {
    if (backgroundVideoRef.current) {
      backgroundVideoRef.current.play().catch(error => {
        console.log('Background video autoplay failed:', error);
      });
    }
    if (overlayVideoRef.current) {
      overlayVideoRef.current.play().catch(error => {
        console.log('Overlay video autoplay failed:', error);
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create FormData to send files
    const form = new FormData();
    form.append('triggerWord', formData.triggerWord);
    form.append('hfToken', process.env.NEXT_PUBLIC_HF_TOKEN || '');

    // Append each file to FormData
    uploadedFiles.forEach((fileObj, index) => {
      form.append(`file${index}`, fileObj.file);
    });

    try {
      // Send data to your backend
      const response = await fetch('/api/train', {
        method: 'POST',
        body: form, // Send FormData directly
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      // Show success popup
      setShowPopup(true);
    } catch (error) {
      console.error('Error submitting form:', error);
      // You might want to show an error message to the user here
    }
  };

  const calculateSpeed = (loaded: number, total: number, startTime: number): { speed: string; timeRemaining: string } => {
    const currentTime = Date.now();
    const elapsedTime = (currentTime - startTime) / 1000; // seconds
    const bytesPerSecond = loaded / elapsedTime;
    
    let speed: string;
    if (bytesPerSecond >= 1048576) {
      speed = `${(bytesPerSecond / 1048576).toFixed(1)} MB/s`;
    } else if (bytesPerSecond >= 1024) {
      speed = `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    } else {
      speed = `${Math.round(bytesPerSecond)} B/s`;
    }

    const remainingBytes = total - loaded;
    const remainingTime = remainingBytes / bytesPerSecond;
    let timeRemaining: string;
    
    if (remainingTime >= 60) {
      timeRemaining = `${Math.round(remainingTime / 60)} min`;
    } else {
      timeRemaining = `${Math.round(remainingTime)} sec`;
    }

    return { speed, timeRemaining };
  };

  const processFiles = async (files: File[]) => {
    setUploadStatus('uploading');
    const newFiles = files.map(file => ({
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading' as const,
      speed: '0 B/s',
      timeRemaining: 'Calculating...',
      file: file
    }));

    // Add all files to state first
    setUploadedFiles(prev => [...prev, ...newFiles]);
    const startIndex = uploadedFiles.length;

    // Upload all files concurrently
    await Promise.all(files.map((file, index) => 
      uploadFile(file, startIndex + index)
    ));

    setUploadStatus('completed');
  };

  const uploadFile = async (file: File, fileIndex: number) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      let startTime = Date.now();
      let lastLoaded = 0;
      let lastUpdate = Date.now();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const currentTime = Date.now();
          // Only update if enough time has passed (throttle updates)
          if (currentTime - lastUpdate < 100) return;
          lastUpdate = currentTime;

          // Calculate progress
          const progress = Math.round((event.loaded / event.total) * 100);
          
          // Calculate speed
          const timeElapsed = (currentTime - startTime) / 1000; // in seconds
          const loadedSinceLastUpdate = event.loaded - lastLoaded;
          const speed = loadedSinceLastUpdate / timeElapsed; // bytes per second
          lastLoaded = event.loaded;
          startTime = currentTime;

          // Calculate time remaining
          const remainingBytes = event.total - event.loaded;
          const timeRemaining = remainingBytes / speed; // seconds

          // Format speed and time for display
          const speedFormatted = speed < 1024 ? `${Math.round(speed)} B/s` 
            : speed < 1048576 ? `${Math.round(speed / 1024)} KB/s`
            : `${Math.round(speed / 1048576)} MB/s`;

          const timeRemainingFormatted = timeRemaining < 60 
            ? `${Math.round(timeRemaining)}s`
            : `${Math.round(timeRemaining / 60)}m ${Math.round(timeRemaining % 60)}s`;

          setUploadedFiles(prev => prev.map((f, i) => 
            i === fileIndex ? {
              ...f,
              progress,
              speed: speedFormatted,
              timeRemaining: timeRemainingFormatted,
              status: progress === 100 ? 'completed' : 'uploading'
            } : f
          ));
        }
      });

      xhr.upload.addEventListener('load', () => {
        setUploadedFiles(prev => prev.map((f, i) => 
          i === fileIndex ? { ...f, progress: 100, status: 'completed', speed: '0 KB/s', timeRemaining: 'Completed' } : f
        ));
      });

      xhr.upload.addEventListener('error', () => {
        setUploadedFiles(prev => prev.map((f, i) => 
          i === fileIndex ? { ...f, status: 'error', speed: '0 KB/s', timeRemaining: 'Failed' } : f
        ));
      });

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadedFiles(prev => prev.map((f, i) => 
        i === fileIndex ? { ...f, status: 'error' } : f
      ));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      // Create preview URLs for images
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      const imageUrls = imageFiles.map(file => URL.createObjectURL(file));
      setPreviewImages(prevUrls => [...prevUrls, ...imageUrls]);
      await processFiles(files);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Create preview URLs for images
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      const imageUrls = imageFiles.map(file => URL.createObjectURL(file));
      setPreviewImages(prevUrls => [...prevUrls, ...imageUrls]);
      await processFiles(files);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    // Also remove the preview URL
    if (index < previewImages.length) {
      URL.revokeObjectURL(previewImages[index]); // Clean up the URL
      setPreviewImages(prev => prev.filter((_, i) => i !== index));
      if (currentImageIndex >= previewImages.length - 1) {
        setCurrentImageIndex(Math.max(0, previewImages.length - 2));
      }
    }
  };

  const nextImage = () => {
    if (currentImageIndex < previewImages.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    }
  };

  const previousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <main className={`min-h-screen relative ${inter.className}`}>
      <VideoBackground />

      {/* Content */}
      <div className="relative z-10 text-white">
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Hunyuan Video LORA WebUI 🧙‍♂️🪄✨⚡⚯</h1>
            <div className="flex items-center gap-4">
              <SignedOut>
                <SignInButton>
                  <button className="px-6 py-2 text-white border-2 border-white rounded-lg hover:bg-white hover:text-black transition-colors duration-200 font-medium">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton>
                  <button className="px-6 py-2 text-white border-2 border-white rounded-lg hover:bg-white hover:text-black transition-colors duration-200 font-medium">
                    Sign Up
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <div className="flex items-center gap-3">
                  <span className="text-white/90 text-base font-medium tracking-wide">{user?.username || user?.firstName}</span>
                  <UserButton 
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox: "w-8 h-8 ring-2 ring-white/50 rounded-full",
                        userButtonBox: "w-8 h-8"
                      }
                    }}
                  />
                </div>
              </SignedIn>
            </div>
          </div>

          <div className="flex gap-8">
            {/* Left Column - Form */}
            <div className="w-[400px] flex-shrink-0">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-base font-medium mb-2">Trigger Word</label>
                  <input
                    type="text"
                    value={formData.triggerWord}
                    onChange={(e) => setFormData({ ...formData, triggerWord: e.target.value })}
                    className="w-full p-3 bg-[#1E1E1E] border border-[#333] rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-base"
                    required
                  />
                </div>

                <div>
                  <label className="block text-base font-medium mb-2">Upload Dataset📜</label>
                  <div 
                    className={`border border-dashed ${isDragging ? 'border-blue-500 bg-[#1E1E1E]/70' : 'border-[#444] bg-[#1E1E1E]'} rounded-lg transition-colors`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <div className="p-4">
                      <input
                        type="file"
                        onChange={handleFileChange}
                        accept=".mp4,.png,.txt"
                        className="hidden"
                        id="dataset-upload"
                        multiple
                      />
                      <div className="flex items-center justify-center gap-3 cursor-pointer p-4">
                        <label
                          htmlFor="dataset-upload"
                          className="bg-[#404040] text-white px-4 py-2 rounded hover:bg-[#4A4A4A] transition-colors cursor-pointer text-base"
                        >
                          Browse...
                        </label>
                        <span className="text-[#888] text-base">Or drop files here</span>
                      </div>
                    </div>
                    <p className="text-sm text-[#888] px-4 pb-4 text-center">
                      Note: Upload only 15 images and its corresponding .txt file, More than 15 pictures are useless
                    </p>

                    {uploadedFiles.length > 0 && (
                      <div className="border-t border-[#333]">
                        <div className="p-4 space-y-3">
                          {uploadStatus !== 'idle' && (
                            <div className="flex items-center justify-between px-2 mb-2">
                              <span className="text-sm font-medium">
                                {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload Complete'}
                              </span>
                              <span className="text-xs text-[#888]">
                                {uploadedFiles.filter(f => f.status === 'completed').length} of {uploadedFiles.length} files
                              </span>
                            </div>
                          )}
                          {uploadedFiles.map((file, index) => (
                            <div key={index} className="bg-[#252525] rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                                  <span className="text-xs text-[#888]">{formatFileSize(file.size)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {file.status === 'uploading' && (
                                    <div className="text-xs text-[#888]">
                                      <span>{file.speed}</span>
                                      <span className="mx-1">•</span>
                                      <span>{file.timeRemaining} left</span>
                                    </div>
                                  )}
                                  {file.status === 'completed' && (
                                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeFile(index)}
                                    className="text-[#888] hover:text-white"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              <div className="w-full bg-[#333] rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-300 ${
                                    file.status === 'completed' ? 'bg-green-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'
                                  }`}
                                  style={{ width: `${file.progress}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-base font-medium mb-2">HF Token (Optional)</label>
                  <input
                    type="text"
                    value={formData.hfToken}
                    onChange={(e) => setFormData({ ...formData, hfToken: e.target.value })}
                    className="w-full p-3 bg-[#1E1E1E] border border-[#333] rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-base"
                    placeholder="Enter your Hugging Face token OR leave blank"
                  />
                  <p className="text-sm text-[#888] mt-1">
                    If left blank, the trained LORA will be saved on public repo of AIchive
                  </p>
                </div>

                {/* Train Button */}
                <div className="flex justify-center mt-6">
                  <SignedIn>
                    <button
                      type="submit"
                      disabled={!formData.triggerWord || uploadedFiles.length === 0 || uploadStatus === 'uploading'}
                      className={`px-6 py-3 rounded-lg text-white font-medium flex items-center gap-2 ${
                        !formData.triggerWord || uploadedFiles.length === 0 || uploadStatus === 'uploading'
                          ? 'bg-purple-500/50 cursor-not-allowed'
                          : 'bg-purple-500 hover:bg-purple-600'
                      }`}
                      onClick={handleSubmit}
                    >
                      Start Training 🚀
                      {uploadStatus === 'uploading' && (
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin ml-2"></div>
                      )}
                    </button>
                  </SignedIn>
                  <SignedOut>
                    <SignInButton mode="modal">
                      <button
                        className="px-6 py-3 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-medium flex items-center gap-2"
                      >
                        Sign in to Train 🚀
                      </button>
                    </SignInButton>
                  </SignedOut>
                </div>
              </form>
            </div>

            {/* Right Column - Media Display */}
            <div className="flex-1 grid grid-rows-2 gap-6" style={{ height: 'calc(100vh - 16rem)', minHeight: '600px' }}>
              {/* Image Preview Area */}
              <div className="bg-[#1E1E1E]/60 backdrop-blur-sm rounded-lg border border-[#333]/50 flex items-center justify-center p-4 overflow-hidden relative" style={{ minHeight: '300px' }}>
                {previewImages.length > 0 ? (
                  <>
                    <img
                      src={previewImages[currentImageIndex]}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain"
                    />
                    {previewImages.length > 1 && (
                      <>
                        <button
                          onClick={previousImage}
                          className={`absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#333333cc] hover:bg-[#444444cc] transition-colors flex items-center justify-center ${
                            currentImageIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          disabled={currentImageIndex === 0}
                        >
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={nextImage}
                          className={`absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#333333cc] hover:bg-[#444444cc] transition-colors flex items-center justify-center ${
                            currentImageIndex === previewImages.length - 1 ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          disabled={currentImageIndex === previewImages.length - 1}
                        >
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#333333cc] px-3 py-1 rounded-full text-sm text-white">
                          {currentImageIndex + 1} / {previewImages.length}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[#888] text-lg">Image Preview</span>
                  </div>
                )}
              </div>

              {/* Video Embed Area */}
              <div className="bg-[#1E1E1E]/80 backdrop-blur-sm rounded-lg border border-[#333] flex items-center justify-center p-4 overflow-hidden" style={{ minHeight: '300px' }}>
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[#888] text-lg">Video Tutorial</span>
                </div>
              </div>
            </div>
          </div>

          <footer className="py-8 border-t border-[#333]/50 mt-8 bg-[#1E1E1E]/50 backdrop-blur-sm">
            <div className="flex justify-center items-center gap-4 max-w-[1200px] mx-auto mb-8 overflow-x-auto">
              <a href="https://github.com/Ai-chive" target="_blank" rel="noopener noreferrer" className="text-[#888] hover:text-white transition-colors text-sm flex items-center gap-1 whitespace-nowrap">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </a>
              <span className="text-[#888]">•</span>
              <a href="https://huggingface.co/Ai-chive" target="_blank" rel="noopener noreferrer" className="text-[#888] hover:text-white transition-colors text-sm flex items-center gap-1 whitespace-nowrap">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.75 4.75c-.578 0-1.116.176-1.563.473-.446.297-.813.718-1.031 1.207-.219.488-.281 1.031-.188 1.559.094.527.344 1.016.719 1.391s.863.625 1.391.719c.527.094 1.07.031 1.559-.188.488-.219.91-.586 1.207-1.031.297-.446.473-.984.473-1.563 0-.773-.309-1.516-.859-2.063-.547-.55-1.289-.859-2.063-.859-.215 0-.43.031-.645.094M7.75 11.75c-.578 0-1.116.176-1.563.473-.446.297-.813.718-1.031 1.207-.219.488-.281 1.031-.188 1.559.094.527.344 1.016.719 1.391s.863.625 1.391.719c.527.094 1.07.031 1.559-.188.488-.219.91-.586 1.207-1.031.297-.446.473-.984.473-1.563 0-.773-.309-1.516-.859-2.063-.547-.55-1.289-.859-2.063-.859-.215 0-.43.031-.645.094M17.75 11.75c-.578 0-1.116.176-1.563.473-.446.297-.813.718-1.031 1.207-.219.488-.281 1.031-.188 1.559.094.527.344 1.016.719 1.391s.863.625 1.391.719c.527.094 1.07.031 1.559-.188.488-.219.91-.586 1.207-1.031.297-.446.473-.984.473-1.563 0-.773-.309-1.516-.859-2.063-.547-.55-1.289-.859-2.063-.859-.215 0-.43.031-.645.094"/>
                </svg>
                Hugging Face
              </a>
              <span className="text-[#888]">•</span>
              <a href="https://www.youtube.com/@Ai_chive" target="_blank" rel="noopener noreferrer" className="text-[#888] hover:text-white transition-colors text-sm flex items-center gap-1 whitespace-nowrap">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                YouTube
              </a>
              <span className="text-[#888]">•</span>
              <a href="https://www.instagram.com/aichive._/" target="_blank" rel="noopener noreferrer" className="text-[#888] hover:text-white transition-colors text-sm flex items-center gap-1 whitespace-nowrap">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16.83 3H7.17C4.87 3 3 4.87 3 7.17v9.66c0 2.3 1.87 4.17 4.17 4.17h9.66c2.3 0 4.17-1.87 4.17-4.17V7.17C21 4.87 19.13 3 16.83 3zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm4-9c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill="currentColor"/>
                  <circle cx="12" cy="12" r="3" fill="currentColor"/>
                </svg>
                Instagram
              </a>
              <span className="text-[#888]">•</span>
              <a href="https://www.linkedin.com/company/aichive/" target="_blank" rel="noopener noreferrer" className="text-[#888] hover:text-white transition-colors text-sm flex items-center gap-1 whitespace-nowrap">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
              </a>
              <span className="text-[#888]">•</span>
              <a href="https://www.threads.net/@aichive._" target="_blank" rel="noopener noreferrer" className="text-[#888] hover:text-white transition-colors text-sm flex items-center gap-1 whitespace-nowrap">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.781 3.631 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291 1.195-.069 2.361.137 3.314.588.07.034.15.058.245.078-.217-1.11-.55-2.184-1.007-3.222-.663-1.504-1.679-2.276-3.167-2.276l-.024.001c-.885.014-1.605.293-2.214.862-.545.509-.88 1.195-1.002 2.042l-2.014-.561c.194-1.284.711-2.343 1.538-3.147.923-.895 2.065-1.36 3.395-1.38 2.146 0 3.77 1.069 4.75 3.159.507 1.079.873 2.212 1.102 3.371.253-.044.516-.064.786-.064h.042c1.543.083 2.803.577 3.746 1.455 1.064.99 1.645 2.39 1.733 3.967.096 1.744-.417 3.46-1.45 4.84C19.922 22.742 17.672 24 14.193 24h-.006z"/>
                </svg>
                Threads
              </a>
              <span className="text-[#888]">•</span>
              <a href="https://in.pinterest.com/aichive_" target="_blank" rel="noopener noreferrer" className="text-[#888] hover:text-white transition-colors text-sm flex items-center gap-1 whitespace-nowrap">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.5.5 0 0 1 .116.485l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-2.436 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
                </svg>
                Pinterest
              </a>
              <span className="text-[#888]">•</span>
              <a href="https://x.com/aichive_" target="_blank" rel="noopener noreferrer" className="text-[#888] hover:text-white transition-colors text-sm flex items-center gap-1 whitespace-nowrap">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                X
              </a>
              <span className="text-[#888]">•</span>
              <a href="https://www.facebook.com/people/Aichive/61574153810306/" target="_blank" rel="noopener noreferrer" className="text-[#888] hover:text-white transition-colors text-sm flex items-center gap-1 whitespace-nowrap">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </a>
              <span className="text-[#888]">•</span>
              <a href="mailto:aichive404@gmail.com" className="text-[#888] hover:text-white transition-colors text-sm flex items-center gap-1 whitespace-nowrap">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                Email
              </a>
            </div>

            <div className="border-t border-[#333] pt-8 mt-8">
              <h3 className="text-center text-xl font-semibold mb-4">Founder Profiles</h3>
              <div className="flex justify-center items-center gap-8">
                <a href="https://www.instagram.com/shau.rya.jain/" target="_blank" rel="noopener noreferrer" className="text-[#888] hover:text-white transition-colors text-base flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  Shaurya
                </a>
                <span className="text-[#888]">|</span>
                <a href="https://www.instagram.com/priyamdey_/" target="_blank" rel="noopener noreferrer" className="text-[#888] hover:text-white transition-colors text-base flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  Priyam
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {showPopup && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 opacity-0 animate-fadeIn"
          style={{
            animation: 'fadeIn 0.3s ease-out forwards',
          }}
        >
          <div 
            className="bg-[#1E1E1E]/90 backdrop-blur-md p-8 rounded-lg max-w-md mx-4 border border-[#333] opacity-0 translate-y-4 animate-slideUp"
            style={{
              animation: 'slideUp 0.3s ease-out 0.1s forwards',
            }}
          >
            <h2 className="text-2xl font-bold mb-4">Training Started 🚀</h2>
            <p className="text-base text-[#888] mb-6">
              Check your Hugging Face profile after 3-4 hours or check this page if you left the HF token blank.
            </p>
            <button
              onClick={() => setShowPopup(false)}
              className="w-full bg-[#333] text-white py-3 px-6 rounded-lg hover:bg-[#444] transition-all duration-300 ease-in-out transform hover:scale-[0.99] active:scale-[0.97] font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
