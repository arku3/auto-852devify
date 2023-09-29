import { Metadata } from 'next';
import { FaceDetection, FileInputForm } from './client';


export const metadata:Metadata = {
  
}
export default function Home() {
  return (
    <main className="container space-y-4 py-4">
      <FileInputForm />
      <FaceDetection />
    </main>
  );
}
