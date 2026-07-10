import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UploadButton } from '@/components/upload/FileUpload';

describe('UploadButton Component', () => {
  const mockOnUploadSuccess = jest.fn();
  const mockOnUploadError = jest.fn();

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