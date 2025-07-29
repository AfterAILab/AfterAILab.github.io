#!/usr/bin/env ruby

# Weekly Issue Generator for AfterAI
# Usage: ruby generate_weekly_issues.rb

require 'yaml'
require 'fileutils'

# Load issue data
data_file = File.join(__dir__, '_data', 'weekly_issues.yml')
issues = YAML.load_file(data_file)

# Ensure directories exist
FileUtils.mkdir_p(File.join(__dir__, 'weekly'))
FileUtils.mkdir_p(File.join(__dir__, '_includes', 'transcriptions', 'en'))
FileUtils.mkdir_p(File.join(__dir__, '_includes', 'transcriptions', 'ja'))

# Generate individual issue files
issues.each do |issue|
  filename = "#{issue['slug']}.html"
  filepath = File.join(__dir__, 'weekly', filename)
  
  content = <<~CONTENT
    ---
    layout: weekly_issue
    title: "AfterAI Weekly Vol.#{issue['number']}"
    slug: #{issue['slug']}
    ---
  CONTENT
  
  File.write(filepath, content)
  puts "Generated: #{filepath}"
  
  # Check if transcription files exist, create placeholders if missing
  en_transcription_path = File.join(__dir__, issue['transcription']['en'])
  ja_transcription_path = File.join(__dir__, issue['transcription']['ja'])
  
  unless File.exist?(en_transcription_path)
    placeholder_content = "# AfterAI Weekly\nVol.#{issue['number']}\n\n*Transcription coming soon...*"
    File.write(en_transcription_path, placeholder_content)
    puts "Created placeholder: #{en_transcription_path}"
  end
  
  unless File.exist?(ja_transcription_path)
    placeholder_content = "# AfterAI Weekly\n第#{issue['number']}号\n\n*文字起こし準備中...*"
    File.write(ja_transcription_path, placeholder_content)
    puts "Created placeholder: #{ja_transcription_path}"
  end
end

puts "\n✅ All weekly issue files generated successfully!"
puts "Each file is now just 4 lines of front matter + layout reference."
puts "All transcription files are present (created placeholders where missing)."

# Validate structure
puts "\n📋 Structure validation:"
issues.each do |issue|
  html_file = File.join(__dir__, 'weekly', "#{issue['slug']}.html")
  en_img = File.join(__dir__, 'img', 'weekly', 'en', "#{issue['slug']}-en.jpg")
  ja_img = File.join(__dir__, 'img', 'weekly', 'ja', "#{issue['slug']}-ja.jpg")
  
  html_exists = File.exist?(html_file)
  en_img_exists = File.exist?(en_img)
  ja_img_exists = File.exist?(ja_img)
  
  status = "Vol.#{issue['number']} (#{issue['slug']}): "
  status += html_exists ? "✅ HTML " : "❌ HTML "
  status += en_img_exists ? "✅ EN-IMG " : "❌ EN-IMG "
  status += ja_img_exists ? "✅ JA-IMG " : "❌ JA-IMG "
  
  puts status
end
