import { describe, it, expect, vi} from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { UploadButton } from '@/components/upload/FileUpload';

describe('UploadButton Component', () => {
  const mockOnUploadSuccess = vi.fn();
  const mockOnUploadError = vi.fn();

  it('should render the upload button correctly', () => {
    render(
      <UploadButton 
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
      />
    );
    
    expect(screen.getByText('Upload File')).toBeInTheDocument();
  });
});