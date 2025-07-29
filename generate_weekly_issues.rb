#!/usr/bin/env ruby

# Weekly Issue Generator for AfterAI
# Usage: ruby generate_weekly_issues.rb

require 'yaml'

# Load issue data
data_file = File.join(__dir__, '_data', 'weekly_issues.yml')
issues = YAML.load_file(data_file)

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
end

puts "\n✅ All weekly issue files generated successfully!"
puts "Each file is now just 4 lines of front matter + layout reference."
